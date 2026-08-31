import { ConflictException } from '@nestjs/common';
import { AdminAuditActionType, AdminAuditTargetType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  UNVERIFIED_USER_CLEANUP_AGE_DAYS,
  UnverifiedUserCleanupService,
} from './unverified-user-cleanup.service';

describe('UnverifiedUserCleanupService', () => {
  const now = new Date('2026-08-31T12:00:00.000Z');
  const cutoff = new Date(now.getTime() - UNVERIFIED_USER_CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000);
  const candidate = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'unused@example.com',
    firstName: 'Unused',
    lastName: 'Participant',
    createdAt: cutoff,
  };

  let transactionMock: {
    user: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    emailAudit: {
      deleteMany: jest.Mock;
    };
    adminAudit: {
      createMany: jest.Mock;
    };
  };
  let prismaMock: {
    user: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: UnverifiedUserCleanupService;

  beforeEach(() => {
    transactionMock = {
      user: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      emailAudit: {
        deleteMany: jest.fn(),
      },
      adminAudit: {
        createMany: jest.fn(),
      },
    };
    prismaMock = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(async callback => callback(transactionMock)),
    };
    service = new UnverifiedUserCleanupService(prismaMock as unknown as PrismaService);
  });

  it('should list only accounts matching every cleanup guard at the inclusive cutoff', async () => {
    prismaMock.user.findMany.mockResolvedValue([candidate]);
    prismaMock.user.count.mockResolvedValue(1);

    const actualResult = await service.listEligibleUsers(1, 100, now);

    expect(actualResult).toEqual({
      users: [candidate],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
      minimumAgeDays: 30,
    });
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        role: UserRole.PARTICIPANT,
        isEmailVerified: false,
        createdAt: { lte: cutoff },
        OR: [{ loginCodeExpiry: null }, { loginCodeExpiry: { lte: now } }],
        registrations: { none: {} },
        passkeys: { none: {} },
        campingOptionRegistrations: { none: {} },
        payments: { none: {} },
        processedPaymentRefunds: { none: {} },
        authoredNotes: { none: {} },
        notes: { none: {} },
        reviewedRegistrations: { none: {} },
        adminAuditRecords: { none: {} },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { email: 'asc' }],
      skip: 0,
      take: 100,
    });
  });

  it('should conditionally delete eligible users, related email audits, and create audit records', async () => {
    transactionMock.user.findMany
      .mockResolvedValueOnce([
        {
          ...candidate,
          emailAudit: [{ id: 'email-audit-1' }],
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    transactionMock.user.deleteMany.mockResolvedValue({ count: 1 });
    transactionMock.emailAudit.deleteMany.mockResolvedValue({ count: 1 });
    transactionMock.adminAudit.createMany.mockResolvedValue({ count: 1 });

    const actualResult = await service.deleteEligibleUsers([candidate.id], 'admin-user-id', now);

    expect(actualResult).toEqual({
      deleted: [candidate],
      skipped: [],
    });
    expect(transactionMock.user.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [candidate.id] },
          role: UserRole.PARTICIPANT,
          isEmailVerified: false,
          createdAt: { lte: cutoff },
          registrations: { none: {} },
          passkeys: { none: {} },
        }),
      })
    );
    expect(transactionMock.emailAudit.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['email-audit-1'] },
      },
    });
    expect(transactionMock.adminAudit.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          adminUserId: 'admin-user-id',
          actionType: AdminAuditActionType.USER_DELETE,
          targetRecordType: AdminAuditTargetType.USER,
          targetRecordId: candidate.id,
          oldValues: {
            role: UserRole.PARTICIPANT,
            isEmailVerified: false,
            minimumAgeDays: UNVERIFIED_USER_CLEANUP_AGE_DAYS,
          },
          reason: 'Unverified account cleanup',
        }),
      ],
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    const auditData = transactionMock.adminAudit.createMany.mock.calls[0][0].data[0].oldValues;
    expect(auditData).not.toHaveProperty('email');
    expect(auditData).not.toHaveProperty('firstName');
    expect(auditData).not.toHaveProperty('lastName');
  });

  it('should return a conflict when concurrent cleanup changes the transaction snapshot', async () => {
    const serializationConflict = new Prisma.PrismaClientKnownRequestError(
      'Transaction write conflict',
      {
        code: 'P2034',
        clientVersion: 'test',
      }
    );
    prismaMock.$transaction.mockRejectedValue(serializationConflict);

    await expect(
      service.deleteEligibleUsers([candidate.id], 'admin-user-id', now)
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.deleteEligibleUsers([candidate.id], 'admin-user-id', now)).rejects.toThrow(
      'Cleanup candidates changed during deletion. Refresh and try again.'
    );
  });

  it('should skip a user who verified after the candidate list was loaded', async () => {
    transactionMock.user.findMany
      .mockResolvedValueOnce([
        {
          ...candidate,
          emailAudit: [{ id: 'email-audit-1' }],
        },
      ])
      .mockResolvedValueOnce([{ id: candidate.id }])
      .mockResolvedValueOnce([
        {
          id: candidate.id,
          role: UserRole.PARTICIPANT,
          isEmailVerified: true,
          createdAt: candidate.createdAt,
          loginCodeExpiry: null,
          _count: {
            registrations: 0,
            passkeys: 0,
            campingOptionRegistrations: 0,
            payments: 0,
            processedPaymentRefunds: 0,
            authoredNotes: 0,
            notes: 0,
            reviewedRegistrations: 0,
            adminAuditRecords: 0,
          },
        },
      ]);
    transactionMock.user.deleteMany.mockResolvedValue({ count: 0 });

    const actualResult = await service.deleteEligibleUsers([candidate.id], 'admin-user-id', now);

    expect(actualResult).toEqual({
      deleted: [],
      skipped: [{ id: candidate.id, reason: 'ALREADY_VERIFIED' }],
    });
    expect(transactionMock.emailAudit.deleteMany).not.toHaveBeenCalled();
    expect(transactionMock.adminAudit.createMany).not.toHaveBeenCalled();
  });

  it('should report arbitrary missing IDs without attempting related cleanup', async () => {
    transactionMock.user.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    transactionMock.user.deleteMany.mockResolvedValue({ count: 0 });

    const actualResult = await service.deleteEligibleUsers(
      ['22222222-2222-4222-8222-222222222222'],
      'admin-user-id',
      now
    );

    expect(actualResult.skipped).toEqual([
      {
        id: '22222222-2222-4222-8222-222222222222',
        reason: 'NOT_FOUND',
      },
    ]);
  });

  it.each([
    [
      'PROTECTED_ROLE',
      {
        role: UserRole.STAFF,
      },
    ],
    [
      'TOO_NEW',
      {
        createdAt: new Date(cutoff.getTime() + 1),
      },
    ],
    [
      'ACTIVE_LOGIN',
      {
        loginCodeExpiry: new Date(now.getTime() + 60_000),
      },
    ],
    [
      'HAS_REGISTRATIONS',
      {
        _count: { registrations: 1 },
      },
    ],
    [
      'HAS_PASSKEYS',
      {
        _count: { passkeys: 1 },
      },
    ],
    [
      'HAS_RELATED_ACTIVITY',
      {
        _count: { campingOptionRegistrations: 1 },
      },
    ],
  ])(
    'should report %s when a submitted account is no longer eligible',
    async (expectedReason, overrides) => {
      const baseCounts = {
        registrations: 0,
        passkeys: 0,
        campingOptionRegistrations: 0,
        payments: 0,
        processedPaymentRefunds: 0,
        authoredNotes: 0,
        notes: 0,
        reviewedRegistrations: 0,
        adminAuditRecords: 0,
      };
      const typedOverrides = overrides as {
        role?: UserRole;
        createdAt?: Date;
        loginCodeExpiry?: Date;
        _count?: Partial<typeof baseCounts>;
      };
      const { _count: countOverrides = {}, ...userOverrides } = typedOverrides;
      transactionMock.user.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: candidate.id,
            role: UserRole.PARTICIPANT,
            isEmailVerified: false,
            createdAt: cutoff,
            loginCodeExpiry: null,
            _count: {
              ...baseCounts,
              ...countOverrides,
            },
            ...userOverrides,
          },
        ]);
      transactionMock.user.deleteMany.mockResolvedValue({ count: 0 });

      const actualResult = await service.deleteEligibleUsers([candidate.id], 'admin-user-id', now);

      expect(actualResult.skipped).toEqual([{ id: candidate.id, reason: expectedReason }]);
    }
  );
});
