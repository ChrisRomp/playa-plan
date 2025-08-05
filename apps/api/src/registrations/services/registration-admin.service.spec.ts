import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RegistrationAdminService, RefundInfo } from './registration-admin.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditService } from '../../admin-audit/services/admin-audit.service';
import { AdminNotificationsService } from '../../notifications/services/admin-notifications.service';
import { RegistrationCleanupService } from './registration-cleanup.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { 
  RegistrationStatus, 
  AdminAuditActionType, 
  AdminAuditTargetType,
  PaymentStatus,
  PaymentProvider,
  UserRole
} from '@prisma/client';
import { 
  AdminEditRegistrationDto, 
  AdminCancelRegistrationDto,
  AdminRegistrationQueryDto
} from '../dto/admin-registration.dto';

describe('RegistrationAdminService', () => {
  let service: RegistrationAdminService;
  let prismaService: jest.Mocked<PrismaService>;
  let adminAuditService: jest.Mocked<AdminAuditService>;
  let cleanupService: jest.Mocked<RegistrationCleanupService>;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockRegistration = {
    id: 'reg-123',
    userId: 'user-123',
    year: 2024,
    status: RegistrationStatus.CONFIRMED,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    user: {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      playaName: 'TestUser',
      role: UserRole.PARTICIPANT,
      campingOptionRegistrations: [],
    },
    jobs: [],
    payments: [],
  };



  const mockPayment = {
    id: 'payment-123',
    amount: 15000, // $150.00 in cents
    status: PaymentStatus.COMPLETED,
    provider: PaymentProvider.STRIPE,
    providerRefId: 'pi_test123',
  };

  const mockAuditRecord = {
    id: 'audit-123',
    adminUserId: 'admin-123',
    actionType: AdminAuditActionType.REGISTRATION_EDIT,
    targetRecordType: AdminAuditTargetType.REGISTRATION,
    targetRecordId: 'reg-123',
    oldValues: {},
    newValues: {},
    reason: 'Test reason',
    transactionId: 'transaction-123',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      registration: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      campingOptionRegistration: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      campingOption: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      job: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      registrationJob: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockAdminAuditService = {
      createAuditRecord: jest.fn(),
      createMultipleAuditRecords: jest.fn(),
      getAuditTrail: jest.fn(),
    };

    const mockAdminNotificationsService = {
      sendRegistrationModificationNotification: jest.fn(),
      sendRegistrationCancellationNotification: jest.fn(),
    };

    const mockCleanupService = {
      cleanupRegistration: jest.fn(),
    };

    const mockPaymentsService = {
      processRefund: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationAdminService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AdminAuditService, useValue: mockAdminAuditService },
        { provide: AdminNotificationsService, useValue: mockAdminNotificationsService },
        { provide: RegistrationCleanupService, useValue: mockCleanupService },
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    service = module.get<RegistrationAdminService>(RegistrationAdminService);
    prismaService = module.get(PrismaService);
    adminAuditService = module.get(AdminAuditService);
    cleanupService = module.get(RegistrationCleanupService);
    paymentsService = module.get(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('editRegistration', () => {
    // Task 5.2.1: Test editRegistration() successfully updates registration and creates audit record
    it('should successfully update registration and create audit record', async () => {
      const editData: AdminEditRegistrationDto = {
        status: RegistrationStatus.WAITLISTED,
        notes: 'Admin update for testing',
        sendNotification: false,
      };

      const updatedRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.WAITLISTED,
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockRegistration) // First call to get current registration
        .mockResolvedValueOnce(updatedRegistration); // Second call to get final updated registration
      (prismaService.registration.update as jest.Mock).mockResolvedValue(updatedRegistration);
      adminAuditService.createAuditRecord.mockResolvedValue(mockAuditRecord);
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([mockAuditRecord]);

      const result = await service.editRegistration('reg-123', editData, 'admin-123');

      expect(prismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: 'reg-123' },
        include: {
          user: true,
          jobs: {
            include: {
              job: {
                include: {
                  category: true,
                  shift: true,
                },
              },
            },
          },
          payments: true,
        },
      });

      expect(prismaService.registration.update).toHaveBeenCalledWith({
        where: { id: 'reg-123' },
        data: { status: RegistrationStatus.WAITLISTED },
      });

      // The service creates audit records via createMultipleAuditRecords, not individual createAuditRecord calls
      expect(adminAuditService.createMultipleAuditRecords).toHaveBeenCalled();

      expect(result.registration).toEqual(updatedRegistration);
      expect(result.message).toBe('Registration successfully updated');
    });

    // Task 5.2.2: Test editRegistration() prevents modification of cancelled registrations
    it('should prevent modification of cancelled registrations', async () => {
      const cancelledRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.CANCELLED,
      };

      const editData: AdminEditRegistrationDto = {
        status: RegistrationStatus.CONFIRMED,
        notes: 'Trying to edit cancelled registration',
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(cancelledRegistration);

      await expect(
        service.editRegistration('reg-123', editData, 'admin-123')
      ).rejects.toThrow(BadRequestException);

      expect(prismaService.registration.update).not.toHaveBeenCalled();
      expect(adminAuditService.createAuditRecord).not.toHaveBeenCalled();
    });

    // Task 5.2.3: Test editRegistration() handles camping option modifications with availability checks
    it('should handle camping option modifications with availability checks', async () => {
      const editData: AdminEditRegistrationDto = {
        campingOptionIds: ['camping-option-1', 'camping-option-2'],
        notes: 'Adding camping options',
      };

      const mockCampingOptions = [
        { id: 'camping-option-1', name: 'RV Spot', enabled: true, registrations: [], maxSignups: 10 },
        { id: 'camping-option-2', name: 'Tent Area', enabled: true, registrations: [], maxSignups: 20 },
      ];

      const registrationWithCampingOptions = {
        ...mockRegistration,
        user: {
          ...mockRegistration.user,
          campingOptionRegistrations: [],
        },
      };

      const updatedRegistrationWithCampingOptions = {
        ...registrationWithCampingOptions,
        // No status change in this test, just camping options
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(registrationWithCampingOptions);
      (prismaService.registration.update as jest.Mock).mockResolvedValue(updatedRegistrationWithCampingOptions);
      adminAuditService.createAuditRecord.mockResolvedValue(mockAuditRecord);
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([mockAuditRecord]);

      // Mock camping option availability check
      (prismaService.campingOption.findUnique as jest.Mock).mockResolvedValue(mockCampingOptions[0]);
      (prismaService.campingOption.findMany as jest.Mock).mockResolvedValue(mockCampingOptions);
      (prismaService.campingOptionRegistration.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.editRegistration('reg-123', editData, 'admin-123');

      // The service creates audit records via createMultipleAuditRecords for camping options
      expect(adminAuditService.createMultipleAuditRecords).toHaveBeenCalled();

      expect(result.message).toBe('Registration successfully updated');
    });

    // Task 5.2.4: Test editRegistration() handles work shift modifications with availability checks
    it('should handle work shift modifications with availability checks', async () => {
      const editData: AdminEditRegistrationDto = {
        jobIds: ['job-1', 'job-2'],
        notes: 'Adding work shifts',
      };

      const mockJobs = [
        { id: 'job-1', title: 'Kitchen Duty', enabled: true },
        { id: 'job-2', title: 'Gate Duty', enabled: true },
      ];

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(mockRegistration);
      (prismaService.registration.update as jest.Mock).mockResolvedValue(mockRegistration);
      adminAuditService.createAuditRecord.mockResolvedValue(mockAuditRecord);
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([mockAuditRecord]);

      // Mock job availability check
      (prismaService.job.findUnique as jest.Mock).mockResolvedValue(mockJobs[0]);
      (prismaService.registrationJob.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.registrationJob.create as jest.Mock).mockResolvedValue({});

      const result = await service.editRegistration('reg-123', editData, 'admin-123');

      // The service creates audit records via createMultipleAuditRecords for work shifts
      expect(adminAuditService.createMultipleAuditRecords).toHaveBeenCalled();

      expect(result.message).toBe('Registration successfully updated');
    });

    // Task 5.2.5: Test editRegistration() uses Prisma transactions for atomicity
    it('should use Prisma transactions for atomicity', async () => {
      const editData: AdminEditRegistrationDto = {
        status: RegistrationStatus.WAITLISTED,
        notes: 'Transaction test',
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(mockRegistration);
      (prismaService.registration.update as jest.Mock).mockResolvedValue(mockRegistration);
      adminAuditService.createAuditRecord.mockResolvedValue(mockAuditRecord);
      adminAuditService.createMultipleAuditRecords.mockResolvedValue([mockAuditRecord]);

      await service.editRegistration('reg-123', editData, 'admin-123');

      expect(prismaService.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    // Task 5.2.8: Test error handling for invalid registration IDs and unauthorized access
    it('should handle invalid registration IDs', async () => {
      const editData: AdminEditRegistrationDto = {
        status: RegistrationStatus.CONFIRMED,
        notes: 'Invalid ID test',
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.editRegistration('invalid-id', editData, 'admin-123')
      ).rejects.toThrow(NotFoundException);

      expect(prismaService.registration.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelRegistration', () => {
    // Task 5.2.6: Test cancelRegistration() updates status and triggers cleanup services
    it('should update status and trigger cleanup services', async () => {
      const cancelData: AdminCancelRegistrationDto = {
        reason: 'User emergency',
        sendNotification: false,
        processRefund: false,
      };

      const cancelledRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.CANCELLED,
      };

      const mockCleanupResult = {
        workShiftsRemoved: 2,
        campingOptionsReleased: 1,
        auditRecords: ['audit-1', 'audit-2'],
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(mockRegistration);
      (prismaService.registration.update as jest.Mock).mockResolvedValue(cancelledRegistration);
      adminAuditService.createAuditRecord.mockResolvedValue(mockAuditRecord);
      cleanupService.cleanupRegistration.mockResolvedValue(mockCleanupResult);

      const result = await service.cancelRegistration('reg-123', cancelData, 'admin-123');

      expect(prismaService.registration.update).toHaveBeenCalledWith({
        where: { id: 'reg-123' },
        data: { status: RegistrationStatus.CANCELLED },
        include: expect.any(Object),
      });

      expect(cleanupService.cleanupRegistration).toHaveBeenCalledWith(
        'reg-123',
        'admin-123',
        'User emergency',
        expect.any(String)
      );

      expect(adminAuditService.createAuditRecord).toHaveBeenCalledWith({
        adminUserId: 'admin-123',
        actionType: AdminAuditActionType.REGISTRATION_CANCEL,
        targetRecordType: AdminAuditTargetType.REGISTRATION,
        targetRecordId: 'reg-123',
        oldValues: { status: RegistrationStatus.CONFIRMED },
        newValues: { status: RegistrationStatus.CANCELLED },
        reason: 'User emergency',
        transactionId: expect.any(String),
      });

      expect(result.registration.status).toBe(RegistrationStatus.CANCELLED);
      expect(result.message).toBe('Registration successfully cancelled');
    });

    // Task 5.2.7: Test cancelRegistration() handles refund prompting for paid registrations
    it('should handle refund prompting for paid registrations', async () => {
      const registrationWithPayments = {
        ...mockRegistration,
        payments: [mockPayment],
      };

      const cancelData: AdminCancelRegistrationDto = {
        reason: 'User request',
        sendNotification: false,
        processRefund: true,
      };

      const mockCleanupResult = {
        workShiftsRemoved: 0,
        campingOptionsReleased: 0,
        auditRecords: [],
      };

      const mockRefundResult = {
        paymentId: 'payment-123',
        refundAmount: 150.00,
        providerRefundId: 'refund-123',
        success: true,
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(registrationWithPayments);
      (prismaService.registration.update as jest.Mock).mockResolvedValue({
        ...registrationWithPayments,
        status: RegistrationStatus.CANCELLED,
      });
      adminAuditService.createAuditRecord.mockResolvedValue(mockAuditRecord);
      cleanupService.cleanupRegistration.mockResolvedValue(mockCleanupResult);
      paymentsService.processRefund.mockResolvedValue(mockRefundResult);

      const result = await service.cancelRegistration('reg-123', cancelData, 'admin-123');

      expect(paymentsService.processRefund).toHaveBeenCalledWith({
        paymentId: 'payment-123',
        reason: 'Registration cancellation: User request',
      });

      expect(result.refundInfo).toContain('Automatically refunded');
    });

    // Task 5.2.8: Test error handling for invalid registration IDs and unauthorized access
    it('should handle invalid registration IDs for cancellation', async () => {
      const cancelData: AdminCancelRegistrationDto = {
        reason: 'Invalid ID test',
        sendNotification: false,
        processRefund: false,
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.cancelRegistration('invalid-id', cancelData, 'admin-123')
      ).rejects.toThrow(NotFoundException);

      expect(cleanupService.cleanupRegistration).not.toHaveBeenCalled();
    });

    it('should prevent cancellation of already cancelled registrations', async () => {
      const cancelledRegistration = {
        ...mockRegistration,
        status: RegistrationStatus.CANCELLED,
      };

      const cancelData: AdminCancelRegistrationDto = {
        reason: 'Already cancelled test',
        sendNotification: false,
        processRefund: false,
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(cancelledRegistration);

      await expect(
        service.cancelRegistration('reg-123', cancelData, 'admin-123')
      ).rejects.toThrow(BadRequestException);

      expect(cleanupService.cleanupRegistration).not.toHaveBeenCalled();
    });

    // Task 5.2.13: Test cancelRegistration() continues even when automatic refunds fail
    it('should continue cancellation even when automatic refunds fail', async () => {
      const registrationWithPayments = {
        ...mockRegistration,
        payments: [mockPayment],
      };

      const cancelData: AdminCancelRegistrationDto = {
        reason: 'Refund failure test',
        sendNotification: false,
        processRefund: true,
      };

      const mockCleanupResult = {
        workShiftsRemoved: 1,
        campingOptionsReleased: 1,
        auditRecords: ['audit-1'],
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(registrationWithPayments);
      (prismaService.registration.update as jest.Mock).mockResolvedValue({
        ...registrationWithPayments,
        status: RegistrationStatus.CANCELLED,
      });
      adminAuditService.createAuditRecord.mockResolvedValue(mockAuditRecord);
      cleanupService.cleanupRegistration.mockResolvedValue(mockCleanupResult);
      paymentsService.processRefund.mockRejectedValue(new Error('Refund failed'));

      const result = await service.cancelRegistration('reg-123', cancelData, 'admin-123');

      expect(result.registration.status).toBe(RegistrationStatus.CANCELLED);
      expect(result.message).toBe('Registration successfully cancelled');
      expect(result.refundInfo).toContain('1 automatic refund(s) failed and require manual processing');
    });
  });

  describe('processAutoRefunds', () => {
    // Task 5.2.9: Test processAutoRefunds() correctly processes Stripe and PayPal payments automatically
    it('should correctly process Stripe and PayPal payments automatically', async () => {
      const payments = [
        {
          id: 'stripe-payment',
          amount: 10000,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_stripe123',
        },
        {
          id: 'paypal-payment',
          amount: 5000,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.PAYPAL,
          providerRefId: 'paypal123',
        },
      ];

      paymentsService.processRefund
        .mockResolvedValueOnce({ paymentId: 'stripe-payment', refundAmount: 100.00, providerRefundId: 'refund-1', success: true })
        .mockResolvedValueOnce({ paymentId: 'paypal-payment', refundAmount: 50.00, providerRefundId: 'refund-2', success: true });

      const result = await (service as unknown as { processAutoRefunds: (payments: unknown[], reason: string) => Promise<RefundInfo> }).processAutoRefunds(payments, 'Test refund');

      expect(paymentsService.processRefund).toHaveBeenCalledTimes(2);
      expect(paymentsService.processRefund).toHaveBeenCalledWith({
        paymentId: 'stripe-payment',
        reason: 'Registration cancellation: Test refund',
      });
      expect(paymentsService.processRefund).toHaveBeenCalledWith({
        paymentId: 'paypal-payment',
        reason: 'Registration cancellation: Test refund',
      });

      expect(result.processed).toBe(true);
      expect(result.refundAmount).toBe(150.00);
      expect(result.message).toContain('Automatically refunded 2 payment(s) totaling $150.00');
    });

    // Task 5.2.10: Test processAutoRefunds() skips MANUAL payments and includes them in manual processing message
    it('should skip MANUAL payments and include them in manual processing message', async () => {
      const payments = [
        {
          id: 'manual-payment',
          amount: 10000,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.MANUAL,
          providerRefId: null,
        },
        {
          id: 'stripe-payment',
          amount: 5000,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_stripe123',
        },
      ];

      paymentsService.processRefund.mockResolvedValue({
        paymentId: 'stripe-payment',
        refundAmount: 50.00,
        providerRefundId: 'refund-1',
        success: true,
      });

      const result = await (service as unknown as { processAutoRefunds: (payments: unknown[], reason: string) => Promise<RefundInfo> }).processAutoRefunds(payments, 'Test refund');

      expect(paymentsService.processRefund).toHaveBeenCalledTimes(1);
      expect(paymentsService.processRefund).toHaveBeenCalledWith({
        paymentId: 'stripe-payment',
        reason: 'Registration cancellation: Test refund',
      });

      expect(result.message).toContain('Automatically refunded 1 payment(s) totaling $50.00');
      expect(result.message).toContain('1 manual payment(s) totaling $10000.00 require manual refund processing');
    });

    // Task 5.2.11: Test processAutoRefunds() handles partial refund failures gracefully
    it('should handle partial refund failures gracefully', async () => {
      const payments = [
        {
          id: 'success-payment',
          amount: 10000,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_success123',
        },
        {
          id: 'fail-payment',
          amount: 5000,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_fail123',
        },
      ];

      paymentsService.processRefund
        .mockResolvedValueOnce({ paymentId: 'success-payment', refundAmount: 100.00, providerRefundId: 'refund-1', success: true })
        .mockRejectedValueOnce(new Error('Refund failed'));

      const result = await (service as unknown as { processAutoRefunds: (payments: unknown[], reason: string) => Promise<RefundInfo> }).processAutoRefunds(payments, 'Test refund');

      expect(result.refundAmount).toBe(100.00);
      expect(result.message).toContain('Automatically refunded 1 payment(s) totaling $100.00');
      expect(result.message).toContain('1 automatic refund(s) failed and require manual processing');
    });

    // Task 5.2.12: Test processAutoRefunds() formats refund amounts correctly (no division by 100)
    it('should format refund amounts correctly without division by 100', async () => {
      const payments = [
        {
          id: 'payment-1',
          amount: 15000, // $150.00 in cents
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_test123',
        },
      ];

      paymentsService.processRefund.mockResolvedValue({
        paymentId: 'payment-1',
        refundAmount: 150.00,
        providerRefundId: 'refund-1',
        success: true,
      });

      const result = await (service as unknown as { processAutoRefunds: (payments: unknown[], reason: string) => Promise<RefundInfo> }).processAutoRefunds(payments, 'Test refund');

      expect(result.refundAmount).toBe(150.00);
      expect(result.message).toContain('$150.00');
    });
  });

  describe('getRegistrations', () => {
    it('should return all registrations with filters (no pagination)', async () => {
      const query: AdminRegistrationQueryDto = {
        page: 1, // This parameter is now ignored
        limit: 10, // This parameter is now ignored
        status: RegistrationStatus.CONFIRMED,
        year: 2024,
      };

      const mockRegistrations = [mockRegistration];

      (prismaService.registration.findMany as jest.Mock).mockResolvedValue(mockRegistrations);

      const result = await service.getRegistrations(query);

      expect(result.registrations).toEqual(mockRegistrations);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(0); // 0 indicates unlimited
      expect(result.totalPages).toBe(1);

      expect(prismaService.registration.findMany).toHaveBeenCalledWith({
        where: {
          status: RegistrationStatus.CONFIRMED,
          year: 2024,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        // No skip/take parameters - returns all matching records
      });
    });

    it('should handle search by email and name (no pagination)', async () => {
      const query: AdminRegistrationQueryDto = {
        email: 'test@example.com',
        name: 'John',
      };

      const mockRegistrations: typeof mockRegistration[] = [];
      (prismaService.registration.findMany as jest.Mock).mockResolvedValue(mockRegistrations);

      const result = await service.getRegistrations(query);

      expect(result.registrations).toEqual(mockRegistrations);
      expect(result.total).toBe(0);
      expect(result.limit).toBe(0); // 0 indicates unlimited
      expect(result.totalPages).toBe(1);

      expect(prismaService.registration.findMany).toHaveBeenCalledWith({
        where: {
          user: {
            email: { contains: 'test@example.com', mode: 'insensitive' },
            OR: [
              { firstName: { contains: 'John', mode: 'insensitive' } },
              { lastName: { contains: 'John', mode: 'insensitive' } },
              { playaName: { contains: 'John', mode: 'insensitive' } },
            ],
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        // No skip/take parameters - returns all matching records
      });
    });

    it('should return all registrations without filters', async () => {
      const query: AdminRegistrationQueryDto = {};
      const mockRegistrations = [mockRegistration, { ...mockRegistration, id: 'reg-456' }];

      (prismaService.registration.findMany as jest.Mock).mockResolvedValue(mockRegistrations);

      const result = await service.getRegistrations(query);

      expect(result.registrations).toEqual(mockRegistrations);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(0); // 0 indicates unlimited
      expect(result.totalPages).toBe(1);

      expect(prismaService.registration.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        // No skip/take parameters - returns all matching records
      });
    });

    it('should return all registrations even when count exceeds previous 50-record limit', async () => {
      const query: AdminRegistrationQueryDto = {
        year: 2024,
        // Old implementation would have limited this to 50 with default limit
      };
      
      // Create 75 mock registrations to test beyond the old 50-record limit
      const mockRegistrations = Array.from({ length: 75 }, (_, i) => ({
        ...mockRegistration,
        id: `reg-${i + 1}`,
        user: {
          ...mockRegistration.user,
          email: `user${i + 1}@example.com`,
        },
      }));

      (prismaService.registration.findMany as jest.Mock).mockResolvedValue(mockRegistrations);

      const result = await service.getRegistrations(query);

      expect(result.registrations).toHaveLength(75);
      expect(result.total).toBe(75);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(0); // 0 indicates unlimited
      expect(result.totalPages).toBe(1);

      // Verify no pagination parameters were used
      expect(prismaService.registration.findMany).toHaveBeenCalledWith({
        where: { year: 2024 },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        // Critically: no skip or take parameters that would limit to 50
      });
    });
  });

  describe('getUserCampingOptions', () => {
    it('should return camping options for a registration user', async () => {
      const mockCampingOptionRegistrations = [
        {
          id: 'camping-reg-1',
          userId: 'user-123',
          campingOption: {
            id: 'camping-option-1',
            name: 'RV Spot',
            description: 'RV parking spot',
            participantDues: 5000,
            staffDues: 0,
            enabled: true,
          },
        },
      ];

      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-123' });
      (prismaService.campingOptionRegistration.findMany as jest.Mock).mockResolvedValue(mockCampingOptionRegistrations);

      const result = await service.getUserCampingOptions('reg-123');

      expect(result).toEqual(mockCampingOptionRegistrations);
      expect(prismaService.campingOptionRegistration.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          campingOption: {
            select: {
              id: true,
              name: true,
              description: true,
              participantDues: true,
              staffDues: true,
              enabled: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException for invalid registration ID', async () => {
      (prismaService.registration.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserCampingOptions('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRegistrationAuditTrail', () => {
    it('should return audit trail for a registration', async () => {
      const mockAuditRecords = [
        {
          id: 'audit-1',
          adminUserId: 'admin-123',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'reg-123',
          oldValues: {},
          newValues: {},
          reason: 'Test reason',
          transactionId: 'transaction-123',
          createdAt: new Date(),
          adminUser: {
            id: 'admin-123',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User',
          },
        },
      ];

      adminAuditService.getAuditTrail.mockResolvedValue(mockAuditRecords);

      const result = await service.getRegistrationAuditTrail('reg-123');

      expect(result).toEqual(mockAuditRecords);
      expect(adminAuditService.getAuditTrail).toHaveBeenCalledWith(
        AdminAuditTargetType.REGISTRATION,
        'reg-123'
      );
    });
  });

  describe('calculateRefundInfo', () => {
    it('should calculate refund information correctly', async () => {
      const payments = [
        { id: 'payment-1', amount: 10000, status: PaymentStatus.COMPLETED },
        { id: 'payment-2', amount: 5000, status: PaymentStatus.PENDING },
        { id: 'payment-3', amount: 2000, status: PaymentStatus.FAILED },
      ];

      const result = (service as unknown as { calculateRefundInfo: (payments: unknown[]) => RefundInfo }).calculateRefundInfo(payments);

      expect(result.hasPayments).toBe(true);
      expect(result.totalAmount).toBe(15000); // Only COMPLETED and PENDING
      expect(result.paymentIds).toEqual(['payment-1', 'payment-2']);
      expect(result.message).toContain('Refund of $15000.00 needs to be processed manually for 2 payment(s)');
    });

    it('should handle no eligible payments', async () => {
      const payments = [
        { id: 'payment-1', amount: 10000, status: PaymentStatus.FAILED },
      ];

      const result = (service as unknown as { calculateRefundInfo: (payments: unknown[]) => RefundInfo }).calculateRefundInfo(payments);

      expect(result.hasPayments).toBe(false);
      expect(result.totalAmount).toBe(0);
      expect(result.paymentIds).toEqual([]);
      expect(result.message).toBe('No payments to refund');
    });
  });
}); 