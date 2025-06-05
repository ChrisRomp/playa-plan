import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationCleanupService } from './registration-cleanup.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditService } from '../../admin-audit/services/admin-audit.service';
import { AdminAuditActionType, AdminAuditTargetType, RegistrationStatus, UserRole } from '@prisma/client';

describe('RegistrationCleanupService', () => {
  let service: RegistrationCleanupService;
  let prismaService: jest.Mocked<PrismaService>;
  let adminAuditService: jest.Mocked<AdminAuditService>;

  const mockRegistration = {
    id: 'reg-123',
    userId: 'user-123',
    year: 2024,
    status: RegistrationStatus.CANCELLED,
    user: {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.PARTICIPANT,
      campingOptionRegistrations: [
        {
          id: 'camping-reg-1',
          userId: 'user-123',
          campingOptionId: 'camping-option-1',
          campingOption: {
            id: 'camping-option-1',
            name: 'RV Spot',
            description: 'RV parking spot',
          },
        },
        {
          id: 'camping-reg-2',
          userId: 'user-123',
          campingOptionId: 'camping-option-2',
          campingOption: {
            id: 'camping-option-2',
            name: 'Tent Area',
            description: 'Tent camping area',
          },
        },
      ],
    },
    jobs: [
      {
        id: 'reg-job-1',
        registrationId: 'reg-123',
        jobId: 'job-1',
        job: {
          id: 'job-1',
          name: 'Kitchen Duty',
          description: 'Kitchen work',
        },
      },
      {
        id: 'reg-job-2',
        registrationId: 'reg-123',
        jobId: 'job-2',
        job: {
          id: 'job-2',
          name: 'Gate Duty',
          description: 'Gate monitoring',
        },
      },
    ],
  };

  const mockAuditRecord = {
    id: 'audit-123',
    adminUserId: 'admin-123',
    actionType: AdminAuditActionType.WORK_SHIFT_REMOVE,
    targetRecordType: AdminAuditTargetType.WORK_SHIFT,
    targetRecordId: 'job-1',
    oldValues: {},
    newValues: {},
    reason: 'Test cleanup',
    transactionId: 'transaction-123',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      registration: {
        findUnique: jest.fn(),
      },
      registrationJob: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      campingOptionRegistration: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockAdminAuditService = {
      createMultipleAuditRecords: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationCleanupService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AdminAuditService, useValue: mockAdminAuditService },
      ],
    }).compile();

    service = module.get<RegistrationCleanupService>(RegistrationCleanupService);
    prismaService = module.get(PrismaService);
    adminAuditService = module.get(AdminAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanupRegistration', () => {
    // Task 5.3.1: Test cleanupRegistration() deletes associated work shifts
    it('should delete associated work shifts', async () => {
      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(mockRegistration);
      (prismaService.registrationJob.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prismaService.campingOptionRegistration.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([
        { ...mockAuditRecord, id: 'audit-1' },
        { ...mockAuditRecord, id: 'audit-2' },
        { ...mockAuditRecord, id: 'audit-3' },
        { ...mockAuditRecord, id: 'audit-4' },
      ]);

      const result = await service.cleanupRegistration('reg-123', 'admin-123', 'User cancelled');

      expect(prismaService.registrationJob.deleteMany).toHaveBeenCalledWith({
        where: { registrationId: 'reg-123' },
      });

      expect(result.workShiftsRemoved).toBe(2);
      expect(result.auditRecords.length).toBe(4);
    });

    // Task 5.3.2: Test cleanupRegistration() releases camping option allocations
    it('should release camping option allocations', async () => {
      const registrationWithNoCampingJobs = {
        ...mockRegistration,
        jobs: [], // No work shifts
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(registrationWithNoCampingJobs);
      (prismaService.campingOptionRegistration.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([
        { ...mockAuditRecord, id: 'audit-1' },
        { ...mockAuditRecord, id: 'audit-2' },
      ]);

      const result = await service.cleanupRegistration('reg-123', 'admin-123', 'User cancelled');

      expect(prismaService.campingOptionRegistration.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['camping-reg-1', 'camping-reg-2'],
          },
        },
      });

      expect(result.campingOptionsReleased).toBe(2);
      expect(result.auditRecords.length).toBe(2);
    });

    // Task 5.3.3: Test cleanup operations handle missing related records gracefully
    it('should handle missing related records gracefully', async () => {
      const registrationWithNoRelated = {
        ...mockRegistration,
        jobs: [],
        user: {
          ...mockRegistration.user,
          campingOptionRegistrations: [],
        },
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(registrationWithNoRelated);
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([]);

      const result = await service.cleanupRegistration('reg-123', 'admin-123', 'User cancelled');

      expect(prismaService.registrationJob.deleteMany).not.toHaveBeenCalled();
      expect(prismaService.campingOptionRegistration.deleteMany).not.toHaveBeenCalled();
      expect(result.workShiftsRemoved).toBe(0);
      expect(result.campingOptionsReleased).toBe(0);
      expect(result.auditRecords).toEqual([]);
    });

    it('should handle missing registration gracefully', async () => {
      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.cleanupRegistration('invalid-id', 'admin-123', 'User cancelled')
      ).rejects.toThrow('Registration invalid-id not found');
    });

    // Task 5.3.4: Test cleanup creates appropriate audit records for each operation
    it('should create appropriate audit records for each operation', async () => {
      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(mockRegistration);
      (prismaService.registrationJob.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prismaService.campingOptionRegistration.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([
        { ...mockAuditRecord, id: 'audit-1' },
        { ...mockAuditRecord, id: 'audit-2' },
        { ...mockAuditRecord, id: 'audit-3' },
        { ...mockAuditRecord, id: 'audit-4' },
      ]);

      await service.cleanupRegistration('reg-123', 'admin-123', 'User cancelled');

      expect(adminAuditService.createMultipleAuditRecords).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            adminUserId: 'admin-123',
            actionType: AdminAuditActionType.WORK_SHIFT_REMOVE,
            targetRecordType: AdminAuditTargetType.WORK_SHIFT,
            targetRecordId: 'job-1',
            reason: 'Removed due to registration cancellation: User cancelled',
          }),
          expect.objectContaining({
            adminUserId: 'admin-123',
            actionType: AdminAuditActionType.WORK_SHIFT_REMOVE,
            targetRecordType: AdminAuditTargetType.WORK_SHIFT,
            targetRecordId: 'job-2',
            reason: 'Removed due to registration cancellation: User cancelled',
          }),
          expect.objectContaining({
            adminUserId: 'admin-123',
            actionType: AdminAuditActionType.CAMPING_OPTION_REMOVE,
            targetRecordType: AdminAuditTargetType.CAMPING_OPTION,
            targetRecordId: 'camping-option-1',
            reason: 'Released due to registration cancellation: User cancelled',
          }),
          expect.objectContaining({
            adminUserId: 'admin-123',
            actionType: AdminAuditActionType.CAMPING_OPTION_REMOVE,
            targetRecordType: AdminAuditTargetType.CAMPING_OPTION,
            targetRecordId: 'camping-option-2',
            reason: 'Released due to registration cancellation: User cancelled',
          }),
        ]),
        expect.any(String) // transactionId
      );
    });

    // Task 5.3.5: Test cleanup operations are atomic and roll back on failures
    it('should be atomic and roll back on failures', async () => {
      prismaService.$transaction.mockRejectedValue(new Error('Database transaction failed'));

      await expect(
        service.cleanupRegistration('reg-123', 'admin-123', 'User cancelled')
      ).rejects.toThrow('Database transaction failed');

      // Verify that the transaction was attempted
      expect(prismaService.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should use provided transaction ID', async () => {
      const customTransactionId = 'custom-tx-123';

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(mockRegistration);
      (prismaService.registrationJob.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prismaService.campingOptionRegistration.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([
        { ...mockAuditRecord, id: 'audit-1' },
        { ...mockAuditRecord, id: 'audit-2' },
      ]);

      await service.cleanupRegistration('reg-123', 'admin-123', 'User cancelled', customTransactionId);

      expect(adminAuditService.createMultipleAuditRecords).toHaveBeenCalledWith(
        expect.any(Array),
        customTransactionId
      );
    });
  });

  describe('cleanupWorkShifts', () => {
    it('should clean up work shifts only', async () => {
      const mockRegistrationJobs = [
        {
          id: 'reg-job-1',
          registrationId: 'reg-123',
          jobId: 'job-1',
          job: { id: 'job-1', name: 'Kitchen Duty' },
        },
        {
          id: 'reg-job-2',
          registrationId: 'reg-123',
          jobId: 'job-2',
          job: { id: 'job-2', name: 'Gate Duty' },
        },
      ];

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registrationJob.findMany as jest.Mock).mockResolvedValue(mockRegistrationJobs);
      (prismaService.registrationJob.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([
        { ...mockAuditRecord, id: 'audit-1' },
        { ...mockAuditRecord, id: 'audit-2' },
      ]);

      const result = await service.cleanupWorkShifts('reg-123', 'admin-123', 'Work shifts modified');

      expect(prismaService.registrationJob.findMany).toHaveBeenCalledWith({
        where: { registrationId: 'reg-123' },
        include: { job: true },
      });

      expect(prismaService.registrationJob.deleteMany).toHaveBeenCalledWith({
        where: { registrationId: 'reg-123' },
      });

      expect(adminAuditService.createMultipleAuditRecords).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            adminUserId: 'admin-123',
            actionType: AdminAuditActionType.WORK_SHIFT_REMOVE,
            targetRecordType: AdminAuditTargetType.WORK_SHIFT,
            targetRecordId: 'job-1',
            reason: 'Work shifts modified',
          }),
          expect.objectContaining({
            adminUserId: 'admin-123',
            actionType: AdminAuditActionType.WORK_SHIFT_REMOVE,
            targetRecordType: AdminAuditTargetType.WORK_SHIFT,
            targetRecordId: 'job-2',
            reason: 'Work shifts modified',
          }),
        ]),
        expect.any(String)
      );

      expect(result).toBe(2);
    });

    it('should return 0 when no work shifts to clean up', async () => {
      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registrationJob.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.cleanupWorkShifts('reg-123', 'admin-123', 'No work shifts');

      expect(result).toBe(0);
      expect(prismaService.registrationJob.deleteMany).not.toHaveBeenCalled();
      expect(adminAuditService.createMultipleAuditRecords).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      prismaService.$transaction.mockRejectedValue(new Error('Database error'));

      await expect(
        service.cleanupWorkShifts('reg-123', 'admin-123', 'Test error')
      ).rejects.toThrow('Database error');
    });
  });

  describe('cleanupCampingOptions', () => {
    it('should clean up camping options only', async () => {
      const mockCampingOptionRegs = [
        {
          id: 'camping-reg-1',
          userId: 'user-123',
          campingOptionId: 'camping-option-1',
          campingOption: { id: 'camping-option-1', name: 'RV Spot' },
        },
        {
          id: 'camping-reg-2',
          userId: 'user-123',
          campingOptionId: 'camping-option-2',
          campingOption: { id: 'camping-option-2', name: 'Tent Area' },
        },
      ];

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.campingOptionRegistration.findMany as jest.Mock).mockResolvedValue(mockCampingOptionRegs);
      (prismaService.campingOptionRegistration.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([
        { ...mockAuditRecord, id: 'audit-1' },
        { ...mockAuditRecord, id: 'audit-2' },
      ]);

      const result = await service.cleanupCampingOptions(
        'user-123',
        ['camping-option-1', 'camping-option-2'],
        'admin-123',
        'Camping options modified'
      );

      expect(prismaService.campingOptionRegistration.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          campingOptionId: { in: ['camping-option-1', 'camping-option-2'] },
        },
        include: { campingOption: true },
      });

      expect(prismaService.campingOptionRegistration.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['camping-reg-1', 'camping-reg-2'] },
        },
      });

      expect(adminAuditService.createMultipleAuditRecords).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            adminUserId: 'admin-123',
            actionType: AdminAuditActionType.CAMPING_OPTION_REMOVE,
            targetRecordType: AdminAuditTargetType.CAMPING_OPTION,
            targetRecordId: 'camping-option-1',
            reason: 'Camping options modified',
          }),
          expect.objectContaining({
            adminUserId: 'admin-123',
            actionType: AdminAuditActionType.CAMPING_OPTION_REMOVE,
            targetRecordType: AdminAuditTargetType.CAMPING_OPTION,
            targetRecordId: 'camping-option-2',
            reason: 'Camping options modified',
          }),
        ]),
        expect.any(String)
      );

      expect(result).toBe(2);
    });

    it('should return 0 when no camping options to clean up', async () => {
      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.campingOptionRegistration.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.cleanupCampingOptions(
        'user-123',
        ['camping-option-1'],
        'admin-123',
        'No camping options'
      );

      expect(result).toBe(0);
      expect(prismaService.campingOptionRegistration.deleteMany).not.toHaveBeenCalled();
      expect(adminAuditService.createMultipleAuditRecords).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      prismaService.$transaction.mockRejectedValue(new Error('Database error'));

      await expect(
        service.cleanupCampingOptions('user-123', ['camping-option-1'], 'admin-123', 'Test error')
      ).rejects.toThrow('Database error');
    });
  });
}); 