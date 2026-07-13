import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { StripeRefundError, StripeService } from './stripe.service';
import { PaypalService } from './paypal.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AdminAuditService } from '../../admin-audit/services/admin-audit.service';
import { PaymentProvider, PaymentRefundStatus, PaymentStatus, RegistrationStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';

// Mock implementations
const mockPrismaService = {
  payment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  paymentRefund: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  registration: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockStripeService = {
  createPaymentIntent: jest.fn(),
  createCheckoutSession: jest.fn(),
  createRefund: jest.fn(),
  findRefundByMetadata: jest.fn(),
  retrieveRefund: jest.fn(),
  getPaymentIntent: jest.fn(),
  getCheckoutSession: jest.fn(),
  constructEventFromWebhook: jest.fn(),
};

const mockPaypalService = {
  createOrder: jest.fn(),
  capturePayment: jest.fn(),
  getOrderDetails: jest.fn(),
  createRefund: jest.fn(),
};

const mockNotificationsService = {
  sendNotification: jest.fn().mockResolvedValue(undefined),
  sendRegistrationConfirmationEmail: jest.fn().mockResolvedValue(true),
};

const mockAdminAuditService = {
  createAuditRecord: jest.fn().mockResolvedValue(undefined),
};

interface MockOperation {
  where?: { id?: string };
  data?: { status?: PaymentStatus };
}

interface MockPaymentRefundCreateArgs {
  data: {
    paymentId: string;
    amountCents: number;
    currency: string;
    status: string;
    processorRefund: boolean;
    providerRefundId?: string | null;
    reason?: string | null;
    resultingRegistrationStatus?: string | null;
    processedByUserId: string;
  };
}

interface MockPaymentRefundUpdateArgs {
  where: { id: string };
  data: {
    status: string;
    providerRefundId?: string | null;
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: PaypalService, useValue: mockPaypalService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: AdminAuditService, useValue: mockAdminAuditService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    // Reset all mocks before each test
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation((operations: unknown) => {
      if (Array.isArray(operations)) {
        const results = operations.map((op: MockOperation) => {
          if (op && op.where && op.data) {
            if (op.where.id === 'payment-id') {
              return {
                id: 'payment-id',
                status: op.data.status,
                amount: 100,
                provider: PaymentProvider.STRIPE,
                providerRefId: 'cs_test_session_id',
                userId: 'user-id',
                registrationId: 'registration-id',
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            } else if (op.where.id === 'registration-id') {
              return {
                id: 'registration-id',
                status: op.data.status,
                userId: 'user-id',
                year: 2024,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            }
          }
          return { id: 'mocked-id' };
        });
        return Promise.resolve(results);
      }
      return Promise.resolve((typeof operations === 'function') ? operations(mockPrismaService) : operations);
    });
    mockPrismaService.paymentRefund.create.mockImplementation(({ data }: MockPaymentRefundCreateArgs) => Promise.resolve({
      id: 'refund-id',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    mockPrismaService.paymentRefund.update.mockImplementation(({ where, data }: MockPaymentRefundUpdateArgs) => Promise.resolve({
      id: where.id,
      paymentId: 'payment-id',
      amountCents: 10000,
      currency: 'USD',
      status: data.status,
      processorRefund: true,
      providerRefundId: data.providerRefundId,
      reason: 'Customer requested refund',
      resultingRegistrationStatus: null,
      processedByUserId: 'admin-id',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    mockPrismaService.paymentRefund.updateMany.mockResolvedValue({ count: 1 });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should reject payment amounts that cannot be represented by refund cents', async () => {
      const inputPaymentDto = {
        amount: PAYMENT_AMOUNT_LIMITS.majorUnits + 0.01,
        currency: 'USD',
        provider: PaymentProvider.MANUAL,
        userId: 'user-id',
      };

      await expect(service.create(inputPaymentDto)).rejects.toThrow(
        `Payment amount exceeds the supported maximum of ${PAYMENT_AMOUNT_LIMITS.majorUnits}`,
      );

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.create).not.toHaveBeenCalled();
    });

    it('should create a payment record', async () => {
      // Mock data
      const mockPaymentDto = {
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.STRIPE,
        userId: 'user-id',
        providerRefId: 'provider-ref-id',
      };

      const mockUser = { id: 'user-id', name: 'Test User' };
      const mockPayment = { 
        id: 'payment-id', 
        ...mockPaymentDto,
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);

      // Execute
      const result = await service.create(mockPaymentDto);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ 
        where: { id: mockPaymentDto.userId } 
      });
      expect(mockPrismaService.payment.create).toHaveBeenCalled();
      expect(result).toEqual(mockPayment);
    });

    it('should ignore any recordedByUserId supplied on the DTO and not connect a recordedBy relation when no actor ID is passed', async () => {
      // Mock data: a caller attempts to smuggle an actor ID via the DTO body
      const mockPaymentDto = {
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.STRIPE,
        userId: 'user-id',
        providerRefId: 'provider-ref-id',
        // Not part of CreatePaymentDto's type, but simulates an attacker-supplied
        // extra property reaching the service if validation were misconfigured.
        recordedByUserId: 'attacker-supplied-admin-id',
      };

      const mockUser = { id: 'user-id', name: 'Test User' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.payment.create.mockResolvedValue({ id: 'payment-id' });

      await service.create(mockPaymentDto);

      const createCallArgs = mockPrismaService.payment.create.mock.calls[0][0];
      expect(createCallArgs.data.recordedBy).toBeUndefined();
    });

    it('should connect the recordedBy relation to the explicit recordedByUserId service parameter', async () => {
      const mockPaymentDto = {
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.STRIPE,
        userId: 'user-id',
        providerRefId: 'provider-ref-id',
      };

      const mockUser = { id: 'user-id', name: 'Test User' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.payment.create.mockResolvedValue({ id: 'payment-id' });

      await service.create(mockPaymentDto, 'authenticated-admin-id');

      const createCallArgs = mockPrismaService.payment.create.mock.calls[0][0];
      expect(createCallArgs.data.recordedBy).toEqual({
        connect: { id: 'authenticated-admin-id' },
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Mock data
      const mockPaymentDto = {
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.STRIPE,
        userId: 'non-existent-user-id',
        providerRefId: 'provider-ref-id',
      };

      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Execute & Assert
      await expect(service.create(mockPaymentDto)).rejects.toThrow(NotFoundException);
    });

    it('should validate registration if registrationId is provided', async () => {
      // Mock data
      const mockPaymentDto = {
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.STRIPE,
        userId: 'user-id',
        registrationId: 'registration-id',
        providerRefId: 'provider-ref-id',
      };

      const mockUser = { id: 'user-id', name: 'Test User' };
      const mockRegistration = { 
        id: 'registration-id', 
        userId: 'user-id',
        status: 'PENDING',
      };
      const mockPayment = { 
        id: 'payment-id', 
        ...mockPaymentDto,
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findUnique.mockResolvedValue(mockRegistration);
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);

      // Execute
      const result = await service.create(mockPaymentDto);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ 
        where: { id: mockPaymentDto.userId } 
      });
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({ 
        where: { id: mockPaymentDto.registrationId } 
      });
      expect(mockPrismaService.payment.create).toHaveBeenCalled();
      expect(result).toEqual(mockPayment);
    });

    it('should throw BadRequestException if registration does not belong to user', async () => {
      // Mock data
      const mockPaymentDto = {
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.STRIPE,
        userId: 'user-id',
        registrationId: 'registration-id',
        providerRefId: 'provider-ref-id',
      };

      const mockUser = { id: 'user-id', name: 'Test User' };
      const mockRegistration = { 
        id: 'registration-id', 
        userId: 'different-user-id', // Different user
        status: 'PENDING',
      };

      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findUnique.mockResolvedValue(mockRegistration);

      // Execute & Assert
      await expect(service.create(mockPaymentDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated payments', async () => {
      // Mock data
      const mockPayments = [
        {
          id: 'payment-1',
          amount: 100,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_payment_1',
          refunds: [{ status: 'PENDING', amountCents: 2500 }],
        },
        {
          id: 'payment-2',
          amount: 200,
          status: PaymentStatus.PARTIALLY_REFUNDED,
          provider: PaymentProvider.MANUAL,
          providerRefId: null,
          refunds: [{ status: 'SUCCEEDED', amountCents: 5000 }],
        },
        {
          id: 'payment-3',
          amount: 125,
          status: PaymentStatus.REFUNDED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_legacy_refunded',
          refunds: [],
        },
        {
          id: 'payment-4',
          amount: 75,
          status: PaymentStatus.FAILED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_failed',
          refunds: [],
        },
      ];
      const mockTotal = 4;

      // Setup mocks
      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(mockTotal);

      // Execute
      const result = await service.findAll(0, 10);

      // Assert
      expect(mockPrismaService.payment.findMany).toHaveBeenCalled();
      expect(mockPrismaService.payment.count).toHaveBeenCalled();
      expect(result).toEqual({
        payments: [
          expect.objectContaining({
            id: 'payment-1',
            refundedAmount: 0,
            netAmount: 100,
            refundableAmount: 75,
            processorRefundAvailable: true,
          }),
          expect.objectContaining({
            id: 'payment-2',
            refundedAmount: 50,
            netAmount: 150,
            refundableAmount: 150,
            processorRefundAvailable: false,
          }),
          expect.objectContaining({
            id: 'payment-3',
            refundedAmount: 125,
            netAmount: 0,
            refundableAmount: 0,
            processorRefundAvailable: false,
          }),
          expect.objectContaining({
            id: 'payment-4',
            refundableAmount: 0,
            processorRefundAvailable: false,
          }),
        ],
        total: mockTotal,
      });
    });

    it('should apply filters when provided', async () => {
      // Mock data
      const mockPayments = [{
        id: 'payment-1',
        amount: 100,
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'pi_payment_1',
        refunds: [],
      }];
      const mockTotal = 1;
      const userId = 'user-id';
      const status = PaymentStatus.COMPLETED;

      // Setup mocks
      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(mockTotal);

      // Execute
      const result = await service.findAll(0, 10, userId, status, 'registration-id', PaymentProvider.STRIPE, 2026);

      // Assert
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            status,
            registrationId: 'registration-id',
            provider: PaymentProvider.STRIPE,
            OR: [
              { registration: { year: 2026 } },
              {
                registrationId: null,
                createdAt: {
                  gte: new Date(Date.UTC(2026, 0, 1)),
                  lt: new Date(Date.UTC(2027, 0, 1)),
                },
              },
            ],
          },
        })
      );
      expect(mockPrismaService.payment.count).toHaveBeenCalledWith({
        where: {
          userId,
          status,
          registrationId: 'registration-id',
          provider: PaymentProvider.STRIPE,
          OR: [
            { registration: { year: 2026 } },
            {
              registrationId: null,
              createdAt: {
                gte: new Date(Date.UTC(2026, 0, 1)),
                lt: new Date(Date.UTC(2027, 0, 1)),
              },
            },
          ],
        },
      });
      expect(result).toEqual({
        payments: [
          expect.objectContaining({
            id: 'payment-1',
            refundableAmount: 100,
            processorRefundAvailable: true,
          }),
        ],
        total: mockTotal,
      });
    });
  });

  describe('findAllForParticipant', () => {
    it('should return payments with only participant-safe refund fields', async () => {
      // Given: payment with refunds containing only the participant-safe fields (as Prisma select returns)
      const inputRefund = {
        id: 'refund-1',
        paymentId: 'payment-1',
        amountCents: 5000,
        currency: 'USD',
        status: PaymentRefundStatus.SUCCEEDED,
        reason: 'Customer request',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockPayments = [
        {
          id: 'payment-1',
          amount: 100,
          status: PaymentStatus.PARTIALLY_REFUNDED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_test_123',
          refunds: [inputRefund],
        },
      ];

      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(1);

      // When
      const result = await service.findAllForParticipant('user-id');

      // Then: computed overview fields are present
      expect(result.total).toBe(1);
      const actualPayment = result.payments[0];
      expect(actualPayment).toMatchObject({
        id: 'payment-1',
        refundedAmount: 50,
        netAmount: 50,
      });

      // Then: refund array contains only participant-safe fields
      expect(actualPayment.refunds).toHaveLength(1);
      const actualRefund = actualPayment.refunds[0];
      expect(actualRefund).toMatchObject({
        id: 'refund-1',
        paymentId: 'payment-1',
        amountCents: 5000,
        currency: 'USD',
        status: PaymentRefundStatus.SUCCEEDED,
        reason: 'Customer request',
      });

      // Internal admin-only fields must not be present
      expect(actualRefund).not.toHaveProperty('processedByUserId');
      expect(actualRefund).not.toHaveProperty('providerRefundId');
      expect(actualRefund).not.toHaveProperty('processorRefund');
      expect(actualRefund).not.toHaveProperty('resultingRegistrationStatus');
    });

    it('should use a restricted Prisma select for refunds (not include all fields)', async () => {
      // Given
      mockPrismaService.payment.findMany.mockResolvedValue([]);
      mockPrismaService.payment.count.mockResolvedValue(0);

      // When
      await service.findAllForParticipant('user-id');

      // Then: the Prisma query uses select (not include) for refunds
      const findManyCall = mockPrismaService.payment.findMany.mock.calls[0][0];
      expect(findManyCall.include.refunds).toHaveProperty('select');
      expect(findManyCall.include.refunds.select).toMatchObject({
        id: true,
        paymentId: true,
        amountCents: true,
        currency: true,
        status: true,
        reason: true,
        createdAt: true,
        updatedAt: true,
      });
      // Internal fields must not be selected
      expect(findManyCall.include.refunds.select).not.toHaveProperty('processedByUserId');
      expect(findManyCall.include.refunds.select).not.toHaveProperty('providerRefundId');
      expect(findManyCall.include.refunds.select).not.toHaveProperty('processorRefund');
      expect(findManyCall.include.refunds.select).not.toHaveProperty('resultingRegistrationStatus');
    });

    it('should filter by userId and optional status', async () => {
      // Given
      mockPrismaService.payment.findMany.mockResolvedValue([]);
      mockPrismaService.payment.count.mockResolvedValue(0);

      // When
      await service.findAllForParticipant('user-id', 0, 10, PaymentStatus.COMPLETED);

      // Then
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-id', status: PaymentStatus.COMPLETED },
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a payment by ID', async () => {
      // Mock data
      const paymentId = 'payment-id';
      const mockPayment = { 
        id: paymentId, 
        amount: 100,
        status: PaymentStatus.COMPLETED,
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      // Execute
      const result = await service.findOne(paymentId);

      // Assert
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: paymentId },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if payment not found', async () => {
      // Mock data
      const paymentId = 'non-existent-payment-id';

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      // Execute & Assert
      await expect(service.findOne(paymentId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyStripeSession', () => {
    const sessionId = 'cs_test_session_id';
    const mockPayment = {
      id: 'payment-id',
      amount: 100,
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.STRIPE,
      providerRefId: sessionId,
      userId: 'user-id',
      registrationId: 'registration-id',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockRegistration = {
      id: 'registration-id',
      userId: 'user-id',
      status: 'PENDING',
      year: 2024,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
    });

    it('should verify successful payment and update statuses using transaction', async () => {
      // Mock payment with registration
      const paymentWithRegistration = {
        ...mockPayment,
        registration: mockRegistration,
      };

      // Mock successful Stripe session
      const mockStripeSession = {
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
      };

      // Mock updated entities
      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };
      
      const updatedRegistration = {
        ...mockRegistration,
        status: 'CONFIRMED',
      };

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(paymentWithRegistration);
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentWithRegistration);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);
      
      // Mock transaction result
      mockPrismaService.$transaction.mockResolvedValue([updatedPayment, updatedRegistration]);

      // Execute
      const result = await service.verifyStripeSession(sessionId);

      // Assert
      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).toHaveBeenCalledWith(sessionId);
      
      // Verify transaction was called
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      
      expect(result).toEqual({
        sessionId,
        paymentStatus: PaymentStatus.COMPLETED,
        registrationId: mockRegistration.id,
        registrationStatus: 'CONFIRMED',
        paymentId: mockPayment.id,
      });
    });

    it('should verify successful payment without registration', async () => {
      // Mock payment without registration
      const paymentWithoutRegistration = {
        ...mockPayment,
        registrationId: null,
        registration: null,
      };

      // Mock successful Stripe session
      const mockStripeSession = {
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
      };

      // Mock updated payment
      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        registration: null,
      };

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(paymentWithoutRegistration);
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentWithoutRegistration);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);
      mockPrismaService.payment.update.mockResolvedValue(updatedPayment);

      // Execute
      const result = await service.verifyStripeSession(sessionId);

      // Assert
      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).toHaveBeenCalledWith(sessionId);
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: mockPayment.id },
        data: { status: PaymentStatus.COMPLETED },
      });
      
      // No transaction should be used when there's no registration
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      // Transaction already tested
      
      expect(result).toEqual({
        sessionId,
        paymentStatus: PaymentStatus.COMPLETED,
        registrationId: undefined,
        registrationStatus: undefined,
        paymentId: mockPayment.id,
      });
    });

    it('should handle already completed payment', async () => {
      // Mock already completed payment
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        registration: { ...mockRegistration, status: 'CONFIRMED' },
      };

      // Mock successful Stripe session
      const mockStripeSession = {
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
      };

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(completedPayment);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);

      // Execute
      const result = await service.verifyStripeSession(sessionId);

      // Assert
      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).toHaveBeenCalledWith(sessionId);
      
      // Should not update already completed payment
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      // Transaction already tested: expect(mockPrismaService.$transaction).toHaveBeenCalled();
      // Transaction already tested
      
      expect(result).toEqual({
        sessionId,
        paymentStatus: PaymentStatus.COMPLETED,
        registrationId: mockRegistration.id,
        registrationStatus: 'CONFIRMED',
        paymentId: mockPayment.id,
      });
    });

    it('should handle expired session and update payment to failed', async () => {
      // Mock pending payment
      const paymentWithRegistration = {
        ...mockPayment,
        registration: mockRegistration,
      };

      // Mock expired Stripe session
      const mockStripeSession = {
        id: sessionId,
        status: 'expired',
        payment_status: 'unpaid',
      };

      // Updated payment with failed status
      const failedPayment = {
        ...mockPayment,
        status: PaymentStatus.FAILED,
        notes: 'Checkout session expired',
      };

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(paymentWithRegistration);
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentWithRegistration);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);
      mockPrismaService.payment.update.mockResolvedValue(failedPayment);

      // Execute
      const result = await service.verifyStripeSession(sessionId);

      // Assert
      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).toHaveBeenCalledWith(sessionId);
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: mockPayment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });
      
      // No transaction should be used for failed payments
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      // Should not update registration for failed payment
      // Transaction already tested
      
      expect(result).toEqual({
        sessionId,
        paymentStatus: PaymentStatus.FAILED,
        registrationId: mockRegistration.id,
        registrationStatus: 'PENDING',
        paymentId: mockPayment.id,
      });
    });

    it('should handle pending payment with unpaid session', async () => {
      // Mock pending payment
      const paymentWithRegistration = {
        ...mockPayment,
        registration: mockRegistration,
      };

      // Mock unpaid but not expired Stripe session
      const mockStripeSession = {
        id: sessionId,
        status: 'open',
        payment_status: 'unpaid',
      };

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(paymentWithRegistration);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);

      // Execute
      const result = await service.verifyStripeSession(sessionId);

      // Assert
      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).toHaveBeenCalledWith(sessionId);
      // Should not update payment or registration for still-pending session
      // Transaction already tested: expect(mockPrismaService.$transaction).toHaveBeenCalled();
      // Transaction already tested
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual({
        sessionId,
        paymentStatus: PaymentStatus.PENDING,
        registrationId: mockRegistration.id,
        registrationStatus: 'PENDING',
        paymentId: mockPayment.id,
      });
    });

    it('should throw NotFoundException when payment not found', async () => {
      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      // Execute & Assert
      await expect(service.verifyStripeSession(sessionId)).rejects.toThrow(
        new NotFoundException(`Payment not found for Stripe session ${sessionId}`)
      );

      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).not.toHaveBeenCalled();
    });

    it('should handle Stripe service errors', async () => {
      // Mock payment
      const paymentWithRegistration = {
        ...mockPayment,
        registration: mockRegistration,
      };

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(paymentWithRegistration);
      mockStripeService.getCheckoutSession.mockRejectedValue(new Error('Stripe API error'));

      // Execute & Assert
      await expect(service.verifyStripeSession(sessionId)).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).toHaveBeenCalledWith(sessionId);
    });

    it('should handle database transaction errors by falling back to payment update', async () => {
      // Mock payment with registration
      const paymentWithRegistration = {
        ...mockPayment,
        registration: mockRegistration,
      };

      // Mock successful Stripe session
      const mockStripeSession = {
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
      };

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(paymentWithRegistration);
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentWithRegistration);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);
      mockPrismaService.$transaction.mockRejectedValue(new Error('Database transaction error'));
      
      // Mock the direct payment update (fallback)
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        notes: 'Payment completed but registration update failed: Database transaction error',
      });

      // Execute
      const result = await service.verifyStripeSession(sessionId);

      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).toHaveBeenCalledWith(sessionId);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      
      // Should fall back to direct payment update when transaction fails
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPayment.id },
          data: expect.objectContaining({ 
            status: PaymentStatus.COMPLETED
            // notes field has been removed from the implementation
          })
        })
      );
      
      // Result should indicate payment completed
      expect(result.paymentStatus).toBe(PaymentStatus.COMPLETED);
    });

    it('should update only payment status when registration is already confirmed', async () => {
      // Mock payment with already confirmed registration
      const partialCompletePayment = {
        ...mockPayment,
        status: PaymentStatus.PENDING, // Payment still pending
        registration: {
          ...mockRegistration,
          status: 'CONFIRMED', // But registration already confirmed
        },
      };

      // Mock successful Stripe session
      const mockStripeSession = {
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
      };

      // Mock updated results
      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };

      const updatedRegistration = {
        ...mockRegistration,
        status: 'CONFIRMED', // No change needed
      };

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(partialCompletePayment);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);
      mockPrismaService.$transaction.mockResolvedValue([updatedPayment, updatedRegistration]);

      // Execute
      const result = await service.verifyStripeSession(sessionId);

      // Assert
      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).toHaveBeenCalledWith(sessionId);

      // Should still run transaction to update payment
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      
      // Individual update operations shouldn't be called
      // Transaction already tested: expect(mockPrismaService.$transaction).toHaveBeenCalled();
      // Transaction already tested
      
      expect(result).toEqual({
        sessionId,
        paymentStatus: PaymentStatus.COMPLETED,
        registrationId: mockRegistration.id,
        registrationStatus: 'CONFIRMED',
        paymentId: mockPayment.id,
      });
    });
  });

  describe('update', () => {
    const basePayment = {
      id: 'payment-id',
      amount: 100,
      currency: 'USD',
      provider: PaymentProvider.STRIPE,
      userId: 'user-id',
      registrationId: null,
      providerRefId: 'pi_stripe123',
      refunds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update a payment when status is not refund-derived', async () => {
      const inputPayment = { ...basePayment, status: PaymentStatus.PENDING };
      const inputDto = { status: PaymentStatus.COMPLETED };
      const expectedPayment = { ...inputPayment, status: PaymentStatus.COMPLETED };

      mockPrismaService.payment.findUnique.mockResolvedValue(inputPayment);
      mockPrismaService.payment.update.mockResolvedValue(expectedPayment);

      const actualResult = await service.update('payment-id', inputDto);

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: inputDto,
      });
      expect(actualResult).toEqual(expectedPayment);
    });

    it('should update non-status fields even when payment has refund-derived status', async () => {
      const inputPayment = { ...basePayment, status: PaymentStatus.PARTIALLY_REFUNDED };
      const inputDto = { providerRefId: 'pi_new_ref' };
      const expectedPayment = { ...inputPayment, ...inputDto };

      mockPrismaService.payment.findUnique.mockResolvedValue(inputPayment);
      mockPrismaService.payment.update.mockResolvedValue(expectedPayment);

      const actualResult = await service.update('payment-id', inputDto);

      expect(mockPrismaService.payment.update).toHaveBeenCalled();
      expect(actualResult).toEqual(expectedPayment);
    });

    it('should throw BadRequestException when trying to change status of a PARTIALLY_REFUNDED payment', async () => {
      const inputPayment = { ...basePayment, status: PaymentStatus.PARTIALLY_REFUNDED };
      const inputDto = { status: PaymentStatus.COMPLETED };

      mockPrismaService.payment.findUnique.mockResolvedValue(inputPayment);

      await expect(service.update('payment-id', inputDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to change status of a REFUNDED payment', async () => {
      const inputPayment = { ...basePayment, status: PaymentStatus.REFUNDED };
      const inputDto = { status: PaymentStatus.COMPLETED };

      mockPrismaService.payment.findUnique.mockResolvedValue(inputPayment);

      await expect(service.update('payment-id', inputDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to set REFUNDED payment status to PENDING', async () => {
      const inputPayment = { ...basePayment, status: PaymentStatus.REFUNDED };
      const inputDto = { status: PaymentStatus.PENDING };

      mockPrismaService.payment.findUnique.mockResolvedValue(inputPayment);

      await expect(service.update('payment-id', inputDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when payment does not exist', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { status: PaymentStatus.COMPLETED })).rejects.toThrow(NotFoundException);
    });
  });

  describe('processRefund', () => {
    const basePayment = {
      id: 'payment-id',
      amount: 100,
      currency: 'USD',
      status: PaymentStatus.COMPLETED,
      provider: PaymentProvider.STRIPE,
      providerRefId: 'pi_stripe123',
      userId: 'user-id',
      registrationId: 'registration-id',
      externalPaymentMethod: null,
      externalPaymentReference: null,
      recordedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      registration: {
        id: 'registration-id',
        userId: 'user-id',
        status: RegistrationStatus.CONFIRMED,
      },
      refunds: [],
    };

    it('should process a partial Stripe refund and mark the payment partially refunded', async () => {
      const succeededRefund = {
        id: 'refund-id',
        paymentId: 'payment-id',
        amountCents: 2500,
        currency: 'USD',
        status: PaymentRefundStatus.SUCCEEDED,
        processorRefund: true,
        providerRefundId: 're_stripe123',
        reason: 'Partial refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [succeededRefund],
        });
      mockPrismaService.paymentRefund.create.mockResolvedValueOnce({
        ...succeededRefund,
        status: PaymentRefundStatus.PENDING,
        providerRefundId: null,
      });
      mockStripeService.createRefund.mockResolvedValue({ id: 're_stripe123', status: 'succeeded' });
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.processRefund({
        paymentId: 'payment-id',
        amount: 25,
        reason: 'Partial refund',
      }, 'admin-id');

      expect(mockPrismaService.paymentRefund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentId: 'payment-id',
          amountCents: 2500,
          status: PaymentRefundStatus.PENDING,
          processorRefund: true,
          processedByUserId: 'admin-id',
        }),
      });
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'pi_stripe123',
        2500,
        'Partial refund',
        'refund-id',
        {
          refundId: 'refund-id',
          paymentId: 'payment-id',
        },
      );
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.PARTIALLY_REFUNDED },
      });
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 25,
        providerRefundId: 're_stripe123',
        success: true,
        refundStatus: PaymentRefundStatus.SUCCEEDED,
      });
      expect(mockAdminAuditService.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-id',
          actionType: 'PAYMENT_REFUND',
          targetRecordType: 'PAYMENT',
          targetRecordId: 'payment-id',
          oldValues: {
            status: PaymentStatus.COMPLETED,
            refundedAmount: 0,
            refundStatus: PaymentRefundStatus.PENDING,
          },
          newValues: expect.objectContaining({
            status: PaymentStatus.PARTIALLY_REFUNDED,
            refundId: 'refund-id',
            refundAmount: 25,
            refundAmountCents: 2500,
            refundStatus: PaymentRefundStatus.SUCCEEDED,
            providerRefundId: 're_stripe123',
            processorRefund: true,
          }),
          reason: 'Partial refund',
          transactionId: expect.any(String),
          throwOnError: false,
        }),
      );
    });

    it('should keep payment completed when Stripe returns a pending refund status', async () => {
      const pendingRefund = {
        id: 'refund-id',
        paymentId: 'payment-id',
        amountCents: 2500,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: 're_stripe123',
        reason: 'Pending refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [pendingRefund],
        });
      mockPrismaService.paymentRefund.create.mockResolvedValueOnce({
        ...pendingRefund,
        providerRefundId: null,
      });
      mockStripeService.createRefund.mockResolvedValue({ id: 're_stripe123', status: 'pending' });
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.processRefund({
        paymentId: 'payment-id',
        amount: 25,
        reason: 'Pending refund',
      }, 'admin-id');

      expect(mockPrismaService.paymentRefund.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'refund-id',
          status: PaymentRefundStatus.PENDING,
          OR: [
            { providerRefundId: null },
            { providerRefundId: { not: 're_stripe123' } },
          ],
        },
        data: {
          status: PaymentRefundStatus.PENDING,
          providerRefundId: 're_stripe123',
        },
      });
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.COMPLETED },
      });
      expect(mockAdminAuditService.createAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
        oldValues: expect.objectContaining({
          refundedAmount: 0,
        }),
        newValues: expect.objectContaining({
          refundAmount: 25,
          resultingRegistrationStatus: undefined,
        }),
      }));
      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 25,
        providerRefundId: 're_stripe123',
        success: false,
        refundStatus: PaymentRefundStatus.PENDING,
      });
    });

    it('should reconcile a previously pending Stripe refund before rejecting a duplicate refund attempt', async () => {
      const pendingRefund = {
        id: 'pending-refund-id',
        paymentId: 'payment-id',
        amountCents: 10000,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: null,
        reason: 'Full pending refund',
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const succeededRefund = {
        ...pendingRefund,
        status: PaymentRefundStatus.SUCCEEDED,
        providerRefundId: 're_reconciled',
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [pendingRefund],
        })
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [succeededRefund],
        })
        .mockResolvedValueOnce({
          ...basePayment,
          status: PaymentStatus.REFUNDED,
          registration: {
            ...basePayment.registration,
            status: RegistrationStatus.WAITLISTED,
          },
          refunds: [succeededRefund],
        });
      mockStripeService.findRefundByMetadata.mockResolvedValueOnce({ id: 're_reconciled', status: 'succeeded' });
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 1 });

      await expect(service.processRefund({
        paymentId: 'payment-id',
        amount: 10,
        reason: 'Duplicate refund attempt',
      }, 'admin-id')).rejects.toThrow('Cannot refund payment with status REFUNDED');

      expect(mockStripeService.findRefundByMetadata).toHaveBeenCalledWith(
        'pi_stripe123',
        'pending-refund-id',
      );
      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
      expect(mockPrismaService.paymentRefund.updateMany).toHaveBeenCalledWith({
        where: { id: 'pending-refund-id', status: PaymentRefundStatus.PENDING },
        data: {
          status: PaymentRefundStatus.SUCCEEDED,
          providerRefundId: 're_reconciled',
        },
      });
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.REFUNDED },
      });
      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: 'registration-id' },
        data: { status: RegistrationStatus.WAITLISTED },
      });
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
    });

    it('should retry an ambiguous Stripe refund with its idempotency key when no metadata match is found', async () => {
      const pendingRefund = {
        id: 'pending-refund-id',
        paymentId: 'payment-id',
        amountCents: 10000,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: null,
        reason: 'Ambiguous full refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const reconciledRefund = {
        ...pendingRefund,
        status: PaymentRefundStatus.SUCCEEDED,
        providerRefundId: 're_retried',
      };
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [pendingRefund],
        })
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [reconciledRefund],
        })
        .mockResolvedValueOnce({
          ...basePayment,
          status: PaymentStatus.REFUNDED,
          refunds: [reconciledRefund],
        });
      mockStripeService.findRefundByMetadata.mockResolvedValueOnce(null);
      mockStripeService.createRefund.mockResolvedValueOnce({ id: 're_retried', status: 'succeeded' });
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 1 });

      await expect(service.processRefund({
        paymentId: 'payment-id',
        amount: 10,
        reason: 'Follow-up refund attempt',
      }, 'admin-id')).rejects.toThrow('Cannot refund payment with status REFUNDED');

      expect(mockStripeService.findRefundByMetadata).toHaveBeenCalledWith(
        'pi_stripe123',
        'pending-refund-id',
      );
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'pi_stripe123',
        10000,
        'Ambiguous full refund',
        'pending-refund-id',
        {
          refundId: 'pending-refund-id',
          paymentId: 'payment-id',
        },
      );
      expect(mockPrismaService.paymentRefund.updateMany).toHaveBeenCalledWith({
        where: { id: 'pending-refund-id', status: PaymentRefundStatus.PENDING },
        data: {
          status: PaymentRefundStatus.SUCCEEDED,
          providerRefundId: 're_retried',
        },
      });
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
    });

    it('should leave an unlinked pending Stripe refund pending when the retry itself is ambiguous', async () => {
      const pendingRefund = {
        id: 'pending-refund-id',
        paymentId: 'payment-id',
        amountCents: 10000,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: null,
        reason: 'Ambiguous full refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const paymentWithPendingRefund = {
        ...basePayment,
        refunds: [pendingRefund],
      };
      mockPrismaService.payment.findUnique.mockResolvedValueOnce(paymentWithPendingRefund);
      mockStripeService.findRefundByMetadata.mockResolvedValueOnce(null);
      mockStripeService.createRefund.mockRejectedValueOnce(
        new StripeRefundError('Gateway timeout', true),
      );

      await expect(service.processRefund({
        paymentId: 'payment-id',
        amount: 10,
        reason: 'Follow-up refund attempt',
      }, 'admin-id')).rejects.toThrow('Gateway timeout');

      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'pi_stripe123',
        10000,
        'Ambiguous full refund',
        'pending-refund-id',
        {
          refundId: 'pending-refund-id',
          paymentId: 'payment-id',
        },
      );
      expect(mockPrismaService.paymentRefund.update).not.toHaveBeenCalled();
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
    });

    it('should not reapply prior refund registration status while reconciling another pending refund', async () => {
      const priorSucceededRefund = {
        id: 'prior-refund-id',
        paymentId: 'payment-id',
        amountCents: 2500,
        currency: 'USD',
        status: PaymentRefundStatus.SUCCEEDED,
        processorRefund: true,
        providerRefundId: 're_prior',
        reason: 'Prior refund',
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const pendingRefund = {
        id: 'pending-refund-id',
        paymentId: 'payment-id',
        amountCents: 2500,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: 're_pending',
        reason: 'Pending refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const reconciledRefund = {
        ...pendingRefund,
        status: PaymentRefundStatus.SUCCEEDED,
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [priorSucceededRefund, pendingRefund],
        })
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [priorSucceededRefund, reconciledRefund],
        })
        .mockResolvedValueOnce({
          ...basePayment,
          status: PaymentStatus.PARTIALLY_REFUNDED,
          refunds: [priorSucceededRefund, reconciledRefund],
        });
      mockStripeService.retrieveRefund.mockResolvedValueOnce({ id: 're_pending', status: 'succeeded' });
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 1 });

      await expect(service.processRefund({
        paymentId: 'payment-id',
        amount: 60,
        reason: 'Too much refund',
      }, 'admin-id')).rejects.toThrow('Refund amount exceeds remaining refundable balance');

      expect(mockStripeService.retrieveRefund).toHaveBeenCalledWith('re_pending');
      expect(mockPrismaService.paymentRefund.updateMany).toHaveBeenCalledWith({
        where: { id: 'pending-refund-id', status: PaymentRefundStatus.PENDING },
        data: {
          status: PaymentRefundStatus.SUCCEEDED,
          providerRefundId: 're_pending',
        },
      });
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.PARTIALLY_REFUNDED },
      });
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
    });

    it('should not update registration status when Stripe reports a failed refund', async () => {
      const failedRefund = {
        id: 'refund-id',
        paymentId: 'payment-id',
        amountCents: 2500,
        currency: 'USD',
        status: PaymentRefundStatus.FAILED,
        processorRefund: true,
        providerRefundId: 're_stripe123',
        reason: 'Failed refund',
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [failedRefund],
        });
      mockPrismaService.paymentRefund.create.mockResolvedValueOnce({
        ...failedRefund,
        status: PaymentRefundStatus.PENDING,
        providerRefundId: null,
      });
      mockStripeService.createRefund.mockResolvedValue({ id: 're_stripe123', status: 'failed' });
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.processRefund({
        paymentId: 'payment-id',
        amount: 25,
        reason: 'Failed refund',
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
      }, 'admin-id');

      expect(mockPrismaService.paymentRefund.updateMany).toHaveBeenCalledWith({
        where: { id: 'refund-id', status: PaymentRefundStatus.PENDING },
        data: {
          status: PaymentRefundStatus.FAILED,
          providerRefundId: 're_stripe123',
        },
      });
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.COMPLETED },
      });
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 25,
        providerRefundId: 're_stripe123',
        success: false,
        refundStatus: PaymentRefundStatus.FAILED,
      });
    });

    it('should return a pending result when Stripe succeeds but local finalization fails', async () => {
      const pendingRefund = {
        id: 'refund-id',
        paymentId: 'payment-id',
        amountCents: 2500,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: null,
        reason: 'Partial refund',
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce(basePayment);
      mockPrismaService.paymentRefund.create.mockResolvedValueOnce(pendingRefund);
      mockStripeService.createRefund.mockResolvedValueOnce({
        id: 're_stripe123',
        status: 'succeeded',
      });
      mockPrismaService.$transaction
        .mockImplementationOnce((operation: unknown) => (
          typeof operation === 'function'
            ? operation(mockPrismaService)
            : Promise.resolve(operation)
        ))
        .mockRejectedValueOnce(new Error('database commit failed'));

      const result = await service.processRefund({
        paymentId: 'payment-id',
        amount: 25,
        reason: 'Partial refund',
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
      }, 'admin-id');

      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 25,
        providerRefundId: 're_stripe123',
        success: false,
        refundStatus: PaymentRefundStatus.PENDING,
      });
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'pi_stripe123',
        2500,
        'Partial refund',
        'refund-id',
        {
          refundId: 'refund-id',
          paymentId: 'payment-id',
        },
      );
      expect(mockPrismaService.paymentRefund.update).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(mockAdminAuditService.createAuditRecord).not.toHaveBeenCalled();
    });

    it('should return a PENDING result after an ambiguous Stripe error (possiblySubmitted=true)', async () => {
      const pendingRefund = {
        id: 'refund-id',
        paymentId: 'payment-id',
        amountCents: 2500,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: null,
        reason: 'Ambiguous refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce(basePayment);
      mockPrismaService.paymentRefund.create.mockResolvedValueOnce(pendingRefund);
      mockStripeService.createRefund.mockRejectedValue(new StripeRefundError('network timeout', true));

      const actualResult = await service.processRefund({
        paymentId: 'payment-id',
        amount: 25,
        reason: 'Ambiguous refund',
      }, 'admin-id');

      expect(actualResult).toEqual({
        paymentId: 'payment-id',
        refundAmount: 25,
        providerRefundId: 'refund-id',
        success: false,
        refundStatus: PaymentRefundStatus.PENDING,
      });
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'pi_stripe123',
        2500,
        'Ambiguous refund',
        'refund-id',
        {
          refundId: 'refund-id',
          paymentId: 'payment-id',
        },
      );
      expect(mockPrismaService.paymentRefund.update).not.toHaveBeenCalled();
    });

    it('should mark a pending refund failed when Stripe refund preflight fails before submission', async () => {
      const pendingRefund = {
        id: 'refund-id',
        paymentId: 'payment-id',
        amountCents: 2500,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: null,
        reason: 'Preflight failure',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce(basePayment);
      mockPrismaService.paymentRefund.create.mockResolvedValueOnce(pendingRefund);
      mockStripeService.createRefund.mockRejectedValueOnce(new StripeRefundError('Stripe payments are not configured', false));

      await expect(service.processRefund({
        paymentId: 'payment-id',
        amount: 25,
        reason: 'Preflight failure',
      }, 'admin-id')).rejects.toThrow('Stripe payments are not configured');

      expect(mockPrismaService.paymentRefund.update).toHaveBeenCalledWith({
        where: { id: 'refund-id' },
        data: { status: PaymentRefundStatus.FAILED },
      });
    });

    it('should record an offline refund for externally recorded payments without processor automation', async () => {
      const manualPayment = {
        ...basePayment,
        provider: PaymentProvider.MANUAL,
        providerRefId: null,
        externalPaymentMethod: 'PayPal invoice',
        refunds: [],
      };
      const succeededRefund = {
        id: 'refund-id',
        paymentId: 'payment-id',
        amountCents: 10000,
        currency: 'USD',
        status: PaymentRefundStatus.SUCCEEDED,
        processorRefund: false,
        providerRefundId: null,
        reason: 'Offline refund completed',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(manualPayment)
        .mockResolvedValueOnce(manualPayment);
      mockPrismaService.paymentRefund.create.mockResolvedValueOnce(succeededRefund);

      const result = await service.processRefund({
        paymentId: 'payment-id',
        reason: 'Offline refund completed',
      }, 'admin-id');

      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
      expect(mockPaypalService.createRefund).not.toHaveBeenCalled();
      expect(mockPrismaService.paymentRefund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentId: 'payment-id',
          amountCents: 10000,
          status: PaymentRefundStatus.SUCCEEDED,
          processorRefund: false,
        }),
      });
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.REFUNDED },
      });
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 100,
        providerRefundId: 'refund-id',
        success: true,
        refundStatus: PaymentRefundStatus.SUCCEEDED,
      });
    });

    it('should record and audit a partial offline refund', async () => {
      const manualPayment = {
        ...basePayment,
        provider: PaymentProvider.MANUAL,
        providerRefId: null,
        externalPaymentMethod: 'Check',
        refunds: [],
      };
      const succeededRefund = {
        id: 'refund-id',
        paymentId: 'payment-id',
        amountCents: 2500,
        currency: 'USD',
        status: PaymentRefundStatus.SUCCEEDED,
        processorRefund: false,
        providerRefundId: null,
        reason: 'Partial camp fee adjustment',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(manualPayment)
        .mockResolvedValueOnce(manualPayment);
      mockPrismaService.paymentRefund.create.mockResolvedValueOnce(succeededRefund);

      const actualResult = await service.processRefund({
        paymentId: 'payment-id',
        amount: 25,
        reason: 'Partial camp fee adjustment',
      }, 'admin-id');

      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
      expect(mockPaypalService.createRefund).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.PARTIALLY_REFUNDED },
      });
      expect(mockAdminAuditService.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-id',
          actionType: 'PAYMENT_REFUND',
          targetRecordType: 'PAYMENT',
          targetRecordId: 'payment-id',
          oldValues: {
            status: PaymentStatus.COMPLETED,
            refundedAmount: 0,
          },
          newValues: {
            status: PaymentStatus.PARTIALLY_REFUNDED,
            refundId: 'refund-id',
            refundAmount: 25,
            refundAmountCents: 2500,
            refundStatus: PaymentRefundStatus.SUCCEEDED,
            providerRefundId: 'refund-id',
            processorRefund: false,
            resultingRegistrationStatus: undefined,
          },
          reason: 'Partial camp fee adjustment',
          transactionId: expect.any(String),
          throwOnError: false,
        }),
      );
      expect(actualResult).toEqual({
        paymentId: 'payment-id',
        refundAmount: 25,
        providerRefundId: 'refund-id',
        success: true,
        refundStatus: PaymentRefundStatus.SUCCEEDED,
      });
    });

    it('should reject PayPal portal refunds instead of recording a false offline success', async () => {
      const paypalPayment = {
        ...basePayment,
        provider: PaymentProvider.PAYPAL,
        providerRefId: 'paypal-capture-id',
        refunds: [],
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(paypalPayment)
        .mockResolvedValueOnce(paypalPayment);

      await expect(service.processRefund({
        paymentId: 'payment-id',
        amount: 40,
        reason: 'Partial PayPal refund',
      }, 'admin-id')).rejects.toThrow('Automated PayPal refunds are not currently supported');

      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
      expect(mockPaypalService.createRefund).not.toHaveBeenCalled();
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
    });

    it('should reject refunds that exceed the remaining refundable balance', async () => {
      const partiallyRefundedPayment = {
        ...basePayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunds: [{
          id: 'prior-refund-id',
          status: PaymentRefundStatus.SUCCEEDED,
          amountCents: 7500,
        }],
      };
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(partiallyRefundedPayment)
        .mockResolvedValueOnce(partiallyRefundedPayment);

      await expect(service.processRefund({
        paymentId: 'payment-id',
        amount: 30,
      }, 'admin-id')).rejects.toThrow('Refund amount exceeds remaining refundable balance');

      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
    });

    it('should reject a full refund that cannot be represented by refund cents', async () => {
      const oversizedPayment = {
        ...basePayment,
        amount: PAYMENT_AMOUNT_LIMITS.majorUnits + 0.01,
        provider: PaymentProvider.MANUAL,
        providerRefId: 'manual-external',
        refunds: [],
      };
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(oversizedPayment)
        .mockResolvedValueOnce(oversizedPayment);

      await expect(service.processRefund({
        paymentId: 'payment-id',
      }, 'admin-id')).rejects.toThrow(
        `Refund amount exceeds the supported maximum of ${PAYMENT_AMOUNT_LIMITS.majorUnits}`,
      );

      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
    });

    it('should apply an optional registration status change after refund success', async () => {
      const succeededRefund = {
        id: 'refund-id',
        paymentId: 'payment-id',
        amountCents: 10000,
        currency: 'USD',
        status: PaymentRefundStatus.SUCCEEDED,
        processorRefund: true,
        providerRefundId: 're_stripe123',
        reason: 'Move back to waitlist',
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [succeededRefund],
        });
      mockPrismaService.paymentRefund.create.mockResolvedValueOnce({
        ...succeededRefund,
        status: PaymentRefundStatus.PENDING,
        providerRefundId: null,
      });
      mockStripeService.createRefund.mockResolvedValue({ id: 're_stripe123', status: 'succeeded' });
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.processRefund({
        paymentId: 'payment-id',
        reason: 'Move back to waitlist',
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
      }, 'admin-id');

      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: 'registration-id' },
        data: { status: RegistrationStatus.WAITLISTED },
      });
      expect(mockAdminAuditService.createAuditRecord).toHaveBeenCalledTimes(2);
      expect(mockAdminAuditService.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-id',
          actionType: 'REGISTRATION_EDIT',
          targetRecordType: 'REGISTRATION',
          targetRecordId: 'registration-id',
          oldValues: { status: RegistrationStatus.CONFIRMED },
          newValues: { status: RegistrationStatus.WAITLISTED },
          reason: 'Move back to waitlist',
          transactionId: expect.any(String),
          throwOnError: false,
        }),
      );
    });

    it('should reject a registration status change when the payment has no linked registration', async () => {
      const unlinkedPayment = {
        ...basePayment,
        registrationId: null,
        registration: null,
      };
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(unlinkedPayment)
        .mockResolvedValueOnce(unlinkedPayment);

      await expect(service.processRefund({
        paymentId: 'payment-id',
        amount: 25,
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
      }, 'admin-id')).rejects.toThrow(
        'Cannot change registration status for a payment without a linked registration',
      );

      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
    });

    it('should reject status changes for a cancelled registration', async () => {
      const cancelledPayment = {
        ...basePayment,
        registration: {
          ...basePayment.registration,
          status: RegistrationStatus.CANCELLED,
        },
      };
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(cancelledPayment)
        .mockResolvedValueOnce(cancelledPayment);

      await expect(service.processRefund({
        paymentId: 'payment-id',
        amount: 25,
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
      }, 'admin-id')).rejects.toThrow('Cannot edit a cancelled registration');

      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
    });

    it('should reject direct cancellation status changes outside the registration cancellation flow', async () => {
      await expect(service.processRefund({
        paymentId: 'payment-id',
        reason: 'Cancellation',
        resultingRegistrationStatus: RegistrationStatus.CANCELLED,
      }, 'admin-id')).rejects.toThrow('Use the registration cancellation flow to cancel a registration');

      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
    });

    it.each([
      RegistrationStatus.APPLICATION_SUBMITTED,
      RegistrationStatus.APPLICATION_APPROVED,
      RegistrationStatus.APPLICATION_DECLINED,
    ])('should reject application-phase status changes (%s) even when requested directly', async (applicationStatus) => {
      await expect(service.processRefund({
        paymentId: 'payment-id',
        reason: 'Application status change attempt',
        resultingRegistrationStatus: applicationStatus,
      }, 'admin-id')).rejects.toThrow(
        'Cannot set an application-phase registration status from the refund flow',
      );

      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
    });
  });

  describe('reconcilePendingRefund', () => {
    const basePayment = {
      id: 'payment-id',
      amount: 100,
      currency: 'USD',
      status: PaymentStatus.COMPLETED,
      provider: PaymentProvider.STRIPE,
      providerRefId: 'pi_stripe123',
      userId: 'user-id',
      registrationId: 'registration-id',
      externalPaymentMethod: null,
      externalPaymentReference: null,
      recordedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      registration: {
        id: 'registration-id',
        userId: 'user-id',
        status: RegistrationStatus.CONFIRMED,
      },
      refunds: [],
    };

    it('should reconcile a pending Stripe refund without submitting a new refund', async () => {
      const pendingRefund = {
        id: 'pending-refund-id',
        paymentId: 'payment-id',
        amountCents: 10000,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: 're_stripe123',
        reason: 'Full refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const succeededRefund = {
        ...pendingRefund,
        status: PaymentRefundStatus.SUCCEEDED,
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({ ...basePayment, refunds: [pendingRefund] })
        .mockResolvedValueOnce({ ...basePayment, refunds: [pendingRefund] })
        .mockResolvedValueOnce({
          ...basePayment,
          status: PaymentStatus.REFUNDED,
          refunds: [succeededRefund],
        });
      mockStripeService.retrieveRefund.mockResolvedValueOnce({ id: 're_stripe123', status: 'succeeded' });
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.reconcilePendingRefund('payment-id', 'admin-id');

      expect(mockStripeService.retrieveRefund).toHaveBeenCalledWith('re_stripe123');
      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockPrismaService.paymentRefund.updateMany).toHaveBeenCalledWith({
        where: { id: 'pending-refund-id', status: PaymentRefundStatus.PENDING },
        data: {
          status: PaymentRefundStatus.SUCCEEDED,
          providerRefundId: 're_stripe123',
        },
      });
      expect(mockAdminAuditService.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'PAYMENT_REFUND',
          oldValues: expect.objectContaining({ refundStatus: PaymentRefundStatus.PENDING }),
          newValues: expect.objectContaining({ refundStatus: PaymentRefundStatus.SUCCEEDED }),
          transactionId: 'refund-reconcile-pending-refund-id',
        }),
      );
      expect(result).toEqual({
        payment: expect.objectContaining({
          id: 'payment-id',
          status: PaymentStatus.REFUNDED,
        }),
        reconciledRefundIds: ['pending-refund-id'],
      });
    });

    it('should attribute the audit to a second admin who reconciles, not the original refund submitter', async () => {
      // Given: a refund originally submitted by 'first-admin-id'; a different admin
      // ('second-admin-id') triggers reconciliation via the dedicated endpoint.
      const pendingRefund = {
        id: 'pending-refund-id',
        paymentId: 'payment-id',
        amountCents: 10000,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: 're_stripe123',
        reason: 'Full refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'first-admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const succeededRefund = { ...pendingRefund, status: PaymentRefundStatus.SUCCEEDED };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({ ...basePayment, refunds: [pendingRefund] })
        .mockResolvedValueOnce({ ...basePayment, refunds: [pendingRefund] })
        .mockResolvedValueOnce({
          ...basePayment,
          status: PaymentStatus.REFUNDED,
          refunds: [succeededRefund],
        });
      mockStripeService.retrieveRefund.mockResolvedValueOnce({ id: 're_stripe123', status: 'succeeded' });
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 1 });

      // When: second admin reconciles
      await service.reconcilePendingRefund('payment-id', 'second-admin-id');

      // Then: audit is attributed to second-admin-id, not first-admin-id
      expect(mockAdminAuditService.createAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'second-admin-id',
          actionType: 'PAYMENT_REFUND',
          transactionId: 'refund-reconcile-pending-refund-id',
        }),
      );
    });

    it('should throw when the payment has no pending processor refund', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValueOnce({
        ...basePayment,
        refunds: [],
      });

      await expect(service.reconcilePendingRefund('payment-id', 'admin-id')).rejects.toThrow(
        'Payment has no pending processor refund to reconcile',
      );
      expect(mockStripeService.retrieveRefund).not.toHaveBeenCalled();
      expect(mockStripeService.findRefundByMetadata).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the payment does not exist', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValueOnce(null);

      await expect(service.reconcilePendingRefund('missing-payment-id', 'admin-id')).rejects.toThrow(
        'Payment with ID missing-payment-id not found',
      );
    });

    it('should leave the refund pending and not create a duplicate refund when Stripe has no matching record', async () => {
      const pendingRefund = {
        id: 'pending-refund-id',
        paymentId: 'payment-id',
        amountCents: 10000,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: null,
        reason: 'Ambiguous refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({ ...basePayment, refunds: [pendingRefund] })
        .mockResolvedValueOnce({ ...basePayment, refunds: [pendingRefund] });
      mockStripeService.findRefundByMetadata.mockResolvedValueOnce(null);
      mockStripeService.createRefund.mockResolvedValueOnce(null);

      const result = await service.reconcilePendingRefund('payment-id', 'admin-id');

      expect(mockPrismaService.paymentRefund.update).not.toHaveBeenCalled();
      expect(mockPrismaService.paymentRefund.updateMany).not.toHaveBeenCalled();
      expect(mockAdminAuditService.createAuditRecord).not.toHaveBeenCalled();
      expect(result.reconciledRefundIds).toEqual([]);
    });

    it('should not audit a pending provider state that was already recorded', async () => {
      const pendingRefund = {
        id: 'pending-refund-id',
        paymentId: 'payment-id',
        amountCents: 10000,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: 're_stripe123',
        reason: 'Full refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({ ...basePayment, refunds: [pendingRefund] })
        .mockResolvedValueOnce({ ...basePayment, refunds: [pendingRefund] });
      mockStripeService.retrieveRefund.mockResolvedValueOnce({
        id: 're_stripe123',
        status: 'pending',
      });
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 0 });

      const result = await service.reconcilePendingRefund('payment-id', 'admin-id');

      expect(mockPrismaService.paymentRefund.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'pending-refund-id',
          status: PaymentRefundStatus.PENDING,
          OR: [
            { providerRefundId: null },
            { providerRefundId: { not: 're_stripe123' } },
          ],
        },
        data: {
          status: PaymentRefundStatus.PENDING,
          providerRefundId: 're_stripe123',
        },
      });
      expect(mockAdminAuditService.createAuditRecord).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(result.reconciledRefundIds).toEqual([]);
    });

    it('should process multiple pending refunds in createdAt ascending order so the newest requested registration status wins', async () => {
      // Given: two pending refunds with different resultingRegistrationStatus values.
      // newerRefund is placed first in the array (reversed) to prove the sort is applied;
      // without the sort, retrieveRefund would be called for 're_newer' first and the
      // older WAITLISTED status would win as the final registration state.
      const olderDate = new Date('2024-01-01T10:00:00Z');
      const newerDate = new Date('2024-01-01T11:00:00Z');

      const olderRefund = {
        id: 'refund-older',
        paymentId: 'payment-id',
        amountCents: 2000,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: 're_older',
        reason: 'Partial refund',
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
        processedByUserId: 'admin-id',
        createdAt: olderDate,
        updatedAt: olderDate,
      };
      const newerRefund = {
        id: 'refund-newer',
        paymentId: 'payment-id',
        amountCents: 3000,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: 're_newer',
        reason: 'Additional partial refund',
        resultingRegistrationStatus: RegistrationStatus.CANCELLED,
        processedByUserId: 'admin-id',
        createdAt: newerDate,
        updatedAt: newerDate,
      };
      const succeededOlderRefund = { ...olderRefund, status: PaymentRefundStatus.SUCCEEDED };
      const succeededNewerRefund = { ...newerRefund, status: PaymentRefundStatus.SUCCEEDED };

      // payment.findUnique call sequence:
      // 1. Initial fetch — refunds in reverse order (newerRefund first) to exercise sort
      // 2. Inside tx for olderRefund (processed first after sort) — registration CONFIRMED
      // 3. Inside tx for newerRefund (processed second) — registration WAITLISTED
      // 4. Final refresh
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [newerRefund, olderRefund],
        })
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [succeededOlderRefund, newerRefund],
          registration: { id: 'registration-id', userId: 'user-id', status: RegistrationStatus.CONFIRMED },
        })
        .mockResolvedValueOnce({
          ...basePayment,
          refunds: [succeededOlderRefund, succeededNewerRefund],
          registration: { id: 'registration-id', userId: 'user-id', status: RegistrationStatus.WAITLISTED },
        })
        .mockResolvedValueOnce({
          ...basePayment,
          status: PaymentStatus.PARTIALLY_REFUNDED,
          refunds: [succeededOlderRefund, succeededNewerRefund],
          registration: { id: 'registration-id', userId: 'user-id', status: RegistrationStatus.CANCELLED },
        });

      mockStripeService.retrieveRefund
        .mockResolvedValueOnce({ id: 're_older', status: 'succeeded' })
        .mockResolvedValueOnce({ id: 're_newer', status: 'succeeded' });

      mockPrismaService.paymentRefund.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });

      // When
      const result = await service.reconcilePendingRefund('payment-id', 'admin-id');

      // Then: olderRefund is processed first (sorted ascending by createdAt)
      expect(mockStripeService.retrieveRefund).toHaveBeenNthCalledWith(1, 're_older');
      expect(mockStripeService.retrieveRefund).toHaveBeenNthCalledWith(2, 're_newer');

      // The registration was updated twice; olderRefund's WAITLISTED status came first,
      // then newerRefund's CANCELLED status overwrote it — newest wins.
      const registrationUpdateCalls = mockPrismaService.registration.update.mock.calls;
      expect(registrationUpdateCalls).toHaveLength(2);
      expect(registrationUpdateCalls[0][0]).toMatchObject({
        where: { id: 'registration-id' },
        data: { status: RegistrationStatus.WAITLISTED },
      });
      expect(registrationUpdateCalls[1][0]).toMatchObject({
        where: { id: 'registration-id' },
        data: { status: RegistrationStatus.CANCELLED },
      });

      expect(result.reconciledRefundIds).toEqual(['refund-older', 'refund-newer']);
    });

    it('should skip finalization and audit when a concurrent request already finalized the refund', async () => {
      // Given: a pending refund that Stripe reports as succeeded, but by the time the
      // updateMany runs inside the transaction, another request has already moved it out
      // of PENDING (count === 0).
      const pendingRefund = {
        id: 'pending-refund-id',
        paymentId: 'payment-id',
        amountCents: 10000,
        currency: 'USD',
        status: PaymentRefundStatus.PENDING,
        processorRefund: true,
        providerRefundId: 're_stripe123',
        reason: 'Full refund',
        resultingRegistrationStatus: null,
        processedByUserId: 'admin-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({ ...basePayment, refunds: [pendingRefund] })
        .mockResolvedValueOnce({
          ...basePayment,
          status: PaymentStatus.REFUNDED,
          refunds: [{ ...pendingRefund, status: PaymentRefundStatus.SUCCEEDED }],
        });
      mockStripeService.retrieveRefund.mockResolvedValueOnce({ id: 're_stripe123', status: 'succeeded' });
      // Simulate another concurrent request winning: updateMany matches 0 rows
      mockPrismaService.paymentRefund.updateMany.mockResolvedValueOnce({ count: 0 });

      // When
      const result = await service.reconcilePendingRefund('payment-id', 'admin-id');

      // Then: no audit is written and the refund is not in the reconciled list
      expect(mockAdminAuditService.createAuditRecord).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(result.reconciledRefundIds).toEqual([]);
    });
  });

  describe('deferred-payment side effects', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('clears paymentDeferred when verifyStripeSession lands a paid session on a deferred registration', async () => {
      // Deferred registration: CONFIRMED + paymentDeferred=true,
      // payment row still PENDING (it was created when the user clicked
      // Pay Now from the dashboard, then this verification runs after
      // checkout success).
      mockPrismaService.payment.findFirst.mockResolvedValueOnce({
        id: 'payment-id',
        status: PaymentStatus.PENDING,
        providerRefId: 'cs_deferred_session',
        userId: 'user-id',
        registrationId: 'registration-id',
        registration: {
          id: 'registration-id',
          status: 'CONFIRMED',
          paymentDeferred: true,
        },
      });
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_deferred_session',
        status: 'complete',
        payment_status: 'paid',
      });

      await service.verifyStripeSession('cs_deferred_session');

      // The transaction body issues two prisma update calls; assert the
      // registration update sets both status and clears paymentDeferred.
      expect(mockPrismaService.registration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'registration-id' },
          data: { status: 'CONFIRMED', paymentDeferred: false },
        }),
      );
    });

    it('skips the post-payment confirmation email when paying off a deferred registration (already emailed at creation)', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValueOnce({
        id: 'payment-id',
        status: PaymentStatus.PENDING,
        providerRefId: 'cs_deferred_pay',
        userId: 'user-id',
        registrationId: 'registration-id',
        registration: {
          id: 'registration-id',
          status: 'CONFIRMED',
          paymentDeferred: true,
        },
      });
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_deferred_pay',
        status: 'complete',
        payment_status: 'paid',
      });
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'payment-id',
        status: PaymentStatus.COMPLETED,
        registration: { id: 'registration-id' },
      });

      await service.verifyStripeSession('cs_deferred_pay');

      expect(mockPrismaService.registration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'registration-id' },
          data: { status: 'CONFIRMED', paymentDeferred: false },
        }),
      );
      expect(
        mockNotificationsService.sendRegistrationConfirmationEmail,
      ).not.toHaveBeenCalled();
    });

    it('still clears paymentDeferred on retry when payment is already COMPLETED but registration is still flagged deferred', async () => {
      // Edge case: previous run completed the payment update but the
      // registration update failed and is being retried. Without the
      // widened condition, this case would skip the update and leave
      // paymentDeferred=true forever.
      mockPrismaService.payment.findFirst.mockResolvedValueOnce({
        id: 'payment-id',
        status: PaymentStatus.COMPLETED,
        providerRefId: 'cs_deferred_retry',
        userId: 'user-id',
        registrationId: 'registration-id',
        registration: {
          id: 'registration-id',
          status: 'CONFIRMED',
          paymentDeferred: true,
        },
      });
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_deferred_retry',
        status: 'complete',
        payment_status: 'paid',
      });

      await service.verifyStripeSession('cs_deferred_retry');

      expect(mockPrismaService.registration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'registration-id' },
          data: { status: 'CONFIRMED', paymentDeferred: false },
        }),
      );
    });

    it('skips the update only when payment is COMPLETED AND registration is CONFIRMED AND paymentDeferred is false', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValueOnce({
        id: 'payment-id',
        status: PaymentStatus.COMPLETED,
        providerRefId: 'cs_already_done',
        userId: 'user-id',
        registrationId: 'registration-id',
        registration: {
          id: 'registration-id',
          status: 'CONFIRMED',
          paymentDeferred: false,
        },
      });
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_already_done',
        status: 'complete',
        payment_status: 'paid',
      });

      await service.verifyStripeSession('cs_already_done');

      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
    });

    it('does not overwrite a partially refunded payment when an old paid Stripe session is re-verified', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValueOnce({
        id: 'payment-id',
        status: PaymentStatus.PARTIALLY_REFUNDED,
        providerRefId: 'cs_partially_refunded',
        userId: 'user-id',
        registrationId: 'registration-id',
        registration: {
          id: 'registration-id',
          status: 'CONFIRMED',
          paymentDeferred: false,
        },
      });
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_partially_refunded',
        status: 'complete',
        payment_status: 'paid',
      });

      const result = await service.verifyStripeSession('cs_partially_refunded');

      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(result.paymentStatus).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    });

    it('does not resurrect a cancelled registration when a pending Stripe checkout later completes', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValueOnce({
        id: 'payment-id',
        amount: 100,
        status: PaymentStatus.PENDING,
        providerRefId: 'cs_cancelled_pay',
        userId: 'user-id',
        registrationId: 'registration-id',
        registration: {
          id: 'registration-id',
          status: 'CANCELLED',
          paymentDeferred: true,
        },
      });
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_cancelled_pay',
        status: 'complete',
        payment_status: 'paid',
      });

      const result = await service.verifyStripeSession('cs_cancelled_pay');

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.COMPLETED },
      });
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(result.registrationStatus).toBe(RegistrationStatus.CANCELLED);
    });

    it('does NOT promote a WAITLISTED deferred registration to CONFIRMED on payment — capacity wins', async () => {
      // Deferred + WAITLISTED participant pays via Pay Now CTA. The
      // payment must record + clear paymentDeferred, but the status
      // must stay WAITLISTED (admin / capacity-opens-up is the only path
      // to CONFIRMED for waitlisted registrations).
      mockPrismaService.payment.findFirst.mockResolvedValueOnce({
        id: 'payment-id',
        status: PaymentStatus.PENDING,
        providerRefId: 'cs_waitlisted_pay',
        userId: 'user-id',
        registrationId: 'registration-id',
        registration: {
          id: 'registration-id',
          status: 'WAITLISTED',
          paymentDeferred: true,
        },
      });
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_waitlisted_pay',
        status: 'complete',
        payment_status: 'paid',
      });

      await service.verifyStripeSession('cs_waitlisted_pay');

      expect(mockPrismaService.registration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'registration-id' },
          data: { status: 'WAITLISTED', paymentDeferred: false },
        }),
      );
    });

    it('recordManualPayment marks the registration CONFIRMED and clears paymentDeferred when status COMPLETED', async () => {
      const createdPayment = {
        id: 'payment-manual',
        status: PaymentStatus.COMPLETED,
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.MANUAL,
        userId: 'user-id',
        registrationId: 'registration-id',
        providerRefId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'user-id', name: 'Test User' });
      mockPrismaService.registration.findUnique.mockResolvedValue({
        id: 'registration-id',
        userId: 'user-id',
        status: 'CONFIRMED',
        paymentDeferred: true,
      });
      mockPrismaService.payment.create.mockResolvedValueOnce(createdPayment);
      mockPrismaService.registration.update.mockResolvedValueOnce({
        id: 'registration-id',
        status: 'CONFIRMED',
        paymentDeferred: false,
      });

      await service.recordManualPayment({
        amount: 100,
        currency: 'USD',
        userId: 'user-id',
        registrationId: 'registration-id',
        reference: 'check-123',
        status: PaymentStatus.COMPLETED,
      }, 'admin-id');

      expect(mockPrismaService.registration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'registration-id' },
          data: { status: 'CONFIRMED', paymentDeferred: false },
        }),
      );
      expect(mockAdminAuditService.createAuditRecord).toHaveBeenCalledWith({
        adminUserId: 'admin-id',
        actionType: 'PAYMENT_RECORD',
        targetRecordType: 'PAYMENT',
        targetRecordId: 'payment-manual',
        newValues: {
          amount: 100,
          currency: 'USD',
          provider: PaymentProvider.MANUAL,
          status: PaymentStatus.COMPLETED,
          externalPaymentMethod: undefined,
          externalPaymentReference: 'check-123',
          userId: 'user-id',
          registrationId: 'registration-id',
        },
        reason: 'check-123',
        throwOnError: false,
      });
    });

    it('recordManualPayment preserves CANCELLED registration status', async () => {
      const createdPayment = {
        id: 'payment-manual',
        status: PaymentStatus.COMPLETED,
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.MANUAL,
        userId: 'user-id',
        registrationId: 'registration-id',
        providerRefId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'user-id', name: 'Test User' });
      mockPrismaService.registration.findUnique.mockResolvedValue({
        id: 'registration-id',
        userId: 'user-id',
        status: RegistrationStatus.CANCELLED,
      });
      mockPrismaService.payment.create.mockResolvedValueOnce(createdPayment);
      mockPrismaService.registration.update.mockResolvedValueOnce({
        id: 'registration-id',
        status: RegistrationStatus.CANCELLED,
        paymentDeferred: false,
      });

      await service.recordManualPayment({
        amount: 100,
        userId: 'user-id',
        registrationId: 'registration-id',
        status: PaymentStatus.COMPLETED,
      }, 'admin-id');

      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: 'registration-id' },
        data: {
          status: RegistrationStatus.CANCELLED,
          paymentDeferred: false,
        },
      });
    });

    it('recordManualPayment throws and rolls back when the registration update fails inside the transaction', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'user-id', name: 'Test User' });
      mockPrismaService.registration.findUnique.mockResolvedValue({
        id: 'registration-id',
        userId: 'user-id',
        status: 'CONFIRMED',
        paymentDeferred: true,
      });
      mockPrismaService.payment.create.mockResolvedValueOnce({
        id: 'payment-manual',
        status: PaymentStatus.COMPLETED,
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.MANUAL,
        userId: 'user-id',
        registrationId: 'registration-id',
        providerRefId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.registration.update.mockRejectedValueOnce(new Error('transient database error'));

      await expect(
        service.recordManualPayment({
          amount: 100,
          currency: 'USD',
          userId: 'user-id',
          registrationId: 'registration-id',
          reference: 'check-123',
          status: PaymentStatus.COMPLETED,
        }, 'admin-id'),
      ).rejects.toThrow('transient database error');

      // Audit must not be written because the transaction failed and the payment was rolled back.
      expect(mockAdminAuditService.createAuditRecord).not.toHaveBeenCalled();
    });

    it('recordManualPayment does NOT touch the registration when status is not COMPLETED', async () => {
      const createdPayment = {
        id: 'payment-manual',
        status: PaymentStatus.FAILED,
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.MANUAL,
        userId: 'user-id',
        registrationId: 'registration-id',
        providerRefId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'user-id', name: 'Test User' });
      mockPrismaService.registration.findUnique.mockResolvedValueOnce({
        id: 'registration-id',
        userId: 'user-id',
        status: 'PENDING',
        paymentDeferred: false,
      });
      mockPrismaService.payment.create.mockResolvedValueOnce(createdPayment);

      await service.recordManualPayment({
        amount: 100,
        currency: 'USD',
        userId: 'user-id',
        registrationId: 'registration-id',
        reference: 'manual',
        status: PaymentStatus.FAILED,
      }, 'admin-id');

      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
    });

    it('recordManualPayment does NOT touch the registration when registrationId is absent', async () => {
      const createdPayment = {
        id: 'payment-manual',
        status: PaymentStatus.COMPLETED,
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.MANUAL,
        userId: 'user-id',
        registrationId: null,
        providerRefId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'user-id', name: 'Test User' });
      mockPrismaService.payment.create.mockResolvedValueOnce(createdPayment);

      await service.recordManualPayment({
        amount: 100,
        currency: 'USD',
        userId: 'user-id',
        reference: 'manual',
        status: PaymentStatus.COMPLETED,
      }, 'admin-id');

      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
    });

    it('recordManualPayment creates the payment atomically with its final status without a separate update call', async () => {
      const finalStatus = PaymentStatus.COMPLETED;
      const createdPayment = {
        id: 'payment-manual',
        status: finalStatus,
        amount: 150,
        currency: 'USD',
        provider: PaymentProvider.MANUAL,
        userId: 'user-id',
        registrationId: null,
        providerRefId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'user-id', name: 'Test User' });
      mockPrismaService.payment.create.mockResolvedValueOnce(createdPayment);

      const result = await service.recordManualPayment({
        amount: 150,
        currency: 'USD',
        userId: 'user-id',
        status: finalStatus,
      }, 'admin-id');

      // Payment is created with the final status directly inside a transaction — no separate update call.
      expect(mockPrismaService.$transaction).toHaveBeenCalledWith(expect.any(Function));
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: finalStatus }) }),
      );
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(result.status).toBe(finalStatus);
    });
  });
});
