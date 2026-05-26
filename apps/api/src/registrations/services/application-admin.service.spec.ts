import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AdminAuditActionType,
  AdminAuditTargetType,
  NotificationType,
  RegistrationStatus,
  UserRole,
} from '@prisma/client';
import { AdminAuditService } from '../../admin-audit/services/admin-audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  ApproveApplicationDto,
  BulkApplicationActionDto,
  DeclineApplicationDto,
} from '../dto/application-admin.dto';
import { ApplicationAdminService } from './application-admin.service';

describe('ApplicationAdminService', () => {
  let service: ApplicationAdminService;
  let prismaService: jest.Mocked<PrismaService>;
  let adminAuditService: jest.Mocked<AdminAuditService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let coreConfigService: jest.Mocked<CoreConfigService>;

  const mockCoreConfig = {
    registrationYear: 2025,
  };

  const mockSubmittedApplication = {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    year: 2025,
    status: RegistrationStatus.APPLICATION_SUBMITTED,
    paymentDeferred: false,
    reviewedById: null,
    reviewedAt: null,
    decisionMessage: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    user: {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'applicant@example.com',
      firstName: 'John',
      lastName: 'Doe',
      playaName: 'Dusty',
      role: UserRole.PARTICIPANT,
    },
    reviewedBy: null,
    campingOptionRegistrations: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        userId: '22222222-2222-4222-8222-222222222222',
        registrationId: '11111111-1111-4111-8111-111111111111',
        campingOptionId: '44444444-4444-4444-8444-444444444444',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        campingOption: {
          id: '44444444-4444-4444-8444-444444444444',
          name: 'RV Spot',
          description: 'RV parking',
          enabled: true,
          workShiftsRequired: 0,
          participantDues: 0,
          staffDues: 0,
          maxSignups: 10,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        },
        fieldValues: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            fieldId: '66666666-6666-4666-8666-666666666666',
            registrationId: '33333333-3333-4333-8333-333333333333',
            value: 'ABC123',
            field: {
              id: '66666666-6666-4666-8666-666666666666',
              displayName: 'License Plate',
              description: null,
              dataType: 'TEXT',
              required: false,
              maxLength: null,
              minValue: null,
              maxValue: null,
              order: 1,
              campingOptionId: '44444444-4444-4444-8444-444444444444',
              createdAt: new Date('2025-01-01T00:00:00.000Z'),
              updatedAt: new Date('2025-01-01T00:00:00.000Z'),
            },
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      registration: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationAdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AdminAuditService,
          useValue: {
            createAuditRecord: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            sendNotification: jest.fn(),
          },
        },
        {
          provide: CoreConfigService,
          useValue: {
            findCurrent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApplicationAdminService>(ApplicationAdminService);
    prismaService = module.get(PrismaService);
    adminAuditService = module.get(AdminAuditService);
    notificationsService = module.get(NotificationsService);
    coreConfigService = module.get(CoreConfigService);

    prismaService.$transaction.mockImplementation(
      async (callback: (client: PrismaService) => unknown) => callback(prismaService),
    );
    coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listApplications', () => {
    it('should list applications using the current year and submitted status by default', async () => {
      (prismaService.registration.findMany as jest.Mock).mockResolvedValue([
        mockSubmittedApplication,
      ] as never);
      (prismaService.registration.count as jest.Mock).mockResolvedValue(1 as never);

      const actualResult = await service.listApplications({ search: 'John Doe' });

      expect(coreConfigService.findCurrent).toHaveBeenCalled();
      expect(prismaService.registration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2025,
            status: RegistrationStatus.APPLICATION_SUBMITTED,
            user: expect.objectContaining({
              AND: expect.arrayContaining([
                expect.objectContaining({ OR: expect.any(Array) }),
              ]),
            }),
          }),
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(actualResult).toEqual({
        data: [mockSubmittedApplication],
        total: 1,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('getApplicationDetail', () => {
    it('should throw when the application does not exist', async () => {
      (prismaService.registration.findFirst as jest.Mock).mockResolvedValue(null as never);

      await expect(service.getApplicationDetail('missing-id')).rejects.toThrow(
        new NotFoundException('Application with ID missing-id not found'),
      );
    });
  });

  describe('approveApplication', () => {
    it('should approve a submitted application, create an audit record, and send a notification', async () => {
      const inputDto: ApproveApplicationDto = {
        message: 'Welcome aboard',
      };
      const updatedApplication = {
        ...mockSubmittedApplication,
        status: RegistrationStatus.APPLICATION_APPROVED,
        decisionMessage: 'Welcome aboard',
        reviewedById: '77777777-7777-4777-8777-777777777777',
        reviewedAt: new Date('2025-02-01T00:00:00.000Z'),
        reviewedBy: {
          id: '77777777-7777-4777-8777-777777777777',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          playaName: null,
          role: UserRole.ADMIN,
        },
      };

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(
        mockSubmittedApplication as never,
      );
      (prismaService.registration.updateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);
      (prismaService.registration.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        updatedApplication as never,
      );
      adminAuditService.createAuditRecord.mockResolvedValue({} as never);
      notificationsService.sendNotification.mockResolvedValue(true as never);

      const actualResult = await service.approveApplication(
        mockSubmittedApplication.id,
        '77777777-7777-4777-8777-777777777777',
        inputDto,
      );

      expect(prismaService.registration.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockSubmittedApplication.id,
          status: RegistrationStatus.APPLICATION_SUBMITTED,
        },
        data: expect.objectContaining({
          status: RegistrationStatus.APPLICATION_APPROVED,
          reviewedById: '77777777-7777-4777-8777-777777777777',
          decisionMessage: 'Welcome aboard',
          reviewedAt: expect.any(Date),
        }),
      });
      expect(adminAuditService.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: '77777777-7777-4777-8777-777777777777',
          actionType: AdminAuditActionType.APPLICATION_APPROVE,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: mockSubmittedApplication.id,
          reason: 'Welcome aboard',
        }),
      );
      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        'applicant@example.com',
        NotificationType.APPLICATION_APPROVED,
        expect.objectContaining({
          userId: mockSubmittedApplication.user.id,
          name: 'John Doe',
          playaName: 'Dusty',
          applicationDetails: expect.objectContaining({
            year: 2025,
            decisionMessage: 'Welcome aboard',
          }),
        }),
      );
      expect(actualResult).toEqual(updatedApplication);
    });

    it('should reject approval when the application is not reviewable', async () => {
      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubmittedApplication,
        status: RegistrationStatus.APPLICATION_APPROVED,
      } as never);

      await expect(
        service.approveApplication(mockSubmittedApplication.id, 'admin-id', {}),
      ).rejects.toThrow(new BadRequestException('Application is not in a reviewable state'));

      expect(prismaService.registration.updateMany).not.toHaveBeenCalled();
      expect(adminAuditService.createAuditRecord).not.toHaveBeenCalled();
    });
  });

  describe('declineApplication', () => {
    it('should decline a submitted application and send a decline notification', async () => {
      const inputDto: DeclineApplicationDto = {
        message: 'Camp is full',
      };
      const updatedApplication = {
        ...mockSubmittedApplication,
        status: RegistrationStatus.APPLICATION_DECLINED,
        decisionMessage: 'Camp is full',
      };

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(
        mockSubmittedApplication as never,
      );
      (prismaService.registration.updateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);
      (prismaService.registration.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        updatedApplication as never,
      );
      adminAuditService.createAuditRecord.mockResolvedValue({} as never);
      notificationsService.sendNotification.mockResolvedValue(true as never);

      const actualResult = await service.declineApplication(
        mockSubmittedApplication.id,
        'admin-id',
        inputDto,
      );

      expect(adminAuditService.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: AdminAuditActionType.APPLICATION_DECLINE,
          reason: 'Camp is full',
        }),
      );
      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        'applicant@example.com',
        NotificationType.APPLICATION_DECLINED,
        expect.objectContaining({
          applicationDetails: expect.objectContaining({
            decisionMessage: 'Camp is full',
          }),
        }),
      );
      expect(actualResult).toEqual(updatedApplication);
    });
  });

  describe('bulkProcessApplications', () => {
    it('should require a message for bulk decline actions', async () => {
      const inputDto: BulkApplicationActionDto = {
        ids: [mockSubmittedApplication.id],
        action: 'decline',
      };

      await expect(service.bulkProcessApplications('admin-id', inputDto)).rejects.toThrow(
        new BadRequestException('Message is required when declining applications'),
      );

      expect(prismaService.registration.findMany).not.toHaveBeenCalled();
    });

    it('should process submitted applications and skip missing or non-reviewable ones', async () => {
      const updatedApplication = {
        ...mockSubmittedApplication,
        status: RegistrationStatus.APPLICATION_APPROVED,
      };
      const inputDto: BulkApplicationActionDto = {
        ids: [
          mockSubmittedApplication.id,
          '88888888-8888-4888-8888-888888888888',
          '99999999-9999-4999-8999-999999999999',
        ],
        action: 'approve',
      };

      (prismaService.registration.findMany as jest.Mock).mockResolvedValue([
        mockSubmittedApplication,
        {
          ...mockSubmittedApplication,
          id: '88888888-8888-4888-8888-888888888888',
          status: RegistrationStatus.APPLICATION_APPROVED,
        },
      ] as never);
      (prismaService.registration.updateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);
      (prismaService.registration.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        updatedApplication as never,
      );
      adminAuditService.createAuditRecord.mockResolvedValue({} as never);
      notificationsService.sendNotification.mockResolvedValue(true as never);

      const actualResult = await service.bulkProcessApplications('admin-id', inputDto);

      expect(actualResult).toEqual({
        results: [
          {
            id: mockSubmittedApplication.id,
            status: 'approved',
          },
          {
            id: '88888888-8888-4888-8888-888888888888',
            status: 'skipped',
            error: 'Application is not in a reviewable state',
          },
          {
            id: '99999999-9999-4999-8999-999999999999',
            status: 'skipped',
            error: 'Application not found',
          },
        ],
        processed: 1,
        skipped: 2,
      });
      expect(notificationsService.sendNotification).toHaveBeenCalledTimes(1);
    });
  });
});
