import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { PaypalService } from './paypal.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  AdminAuditActionType,
  AdminAuditTargetType,
  ExternalPaymentMethod,
  PaymentProvider,
  PaymentRefundStatus,
  PaymentStatus,
  Prisma,
  RefundExecutionMode,
  RegistrationStatus,
  UserRole,
} from '@prisma/client';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateRefundDto } from '../dto';
import { GlobalValidationPipe } from '../../common/pipes/validation.pipe';

// Mock implementations
const mockPrismaService = {
  payment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  paymentRefund: {
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  registration: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  adminAudit: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockStripeService = {
  createPaymentIntent: jest.fn(),
  createCheckoutSession: jest.fn(),
  createRefund: jest.fn(),
  createAdminRefund: jest.fn(),
  findAdminRefund: jest.fn(),
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

const expectedSharedPaymentSelect = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  provider: true,
  providerRefId: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  registrationId: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  registration: true,
};

const expectedAdminPaymentSelect = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  provider: true,
  providerRefId: true,
  externalMethod: true,
  externalReference: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  registrationId: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  registration: {
    select: {
      id: true,
      year: true,
      status: true,
    },
  },
  refunds: {
    select: {
      id: true,
      amountCents: true,
      currency: true,
      executionMode: true,
      status: true,
      reason: true,
      externalReference: true,
      resultingRegistrationStatus: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
};

const expectedExternalPaymentSelect = {
  ...expectedAdminPaymentSelect,
  idempotencyKey: true,
};

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
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    // Reset all mocks before each test
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation(
      async (callback: (tx: typeof mockPrismaService) => Promise<unknown>) =>
        callback(mockPrismaService)
    );
    mockPrismaService.payment.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaService.registration.updateMany.mockResolvedValue({ count: 1 });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
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
        where: { id: mockPaymentDto.userId },
      });
      expect(mockPrismaService.payment.create).toHaveBeenCalled();
      expect(result).toEqual(mockPayment);
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
        where: { id: mockPaymentDto.userId },
      });
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: mockPaymentDto.registrationId },
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
        { id: 'payment-1', amount: 100 },
        { id: 'payment-2', amount: 200 },
      ];
      const mockTotal = 2;

      // Setup mocks
      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(mockTotal);

      // Execute
      const result = await service.findAll(0, 10);

      // Assert
      expect(mockPrismaService.payment.findMany).toHaveBeenCalled();
      expect(mockPrismaService.payment.count).toHaveBeenCalled();
      expect(result).toEqual({ payments: mockPayments, total: mockTotal });
    });

    describe('findAllForAdmin', () => {
      it('should return a bounded admin-safe projection', async () => {
        const mockPayment = {
          id: 'payment-id',
          amount: 125,
          currency: 'USD',
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.MANUAL,
          externalMethod: ExternalPaymentMethod.CHECK,
          externalReference: 'check-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'user-id',
          registrationId: 'registration-id',
          user: {
            id: 'user-id',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
          registration: {
            id: 'registration-id',
            year: 2026,
            status: RegistrationStatus.CONFIRMED,
          },
          refunds: [
            {
              id: 'succeeded-refund',
              amountCents: 2500,
              currency: 'USD',
              executionMode: RefundExecutionMode.MANUAL,
              status: PaymentRefundStatus.SUCCEEDED,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'pending-refund',
              amountCents: 1000,
              currency: 'USD',
              executionMode: RefundExecutionMode.STRIPE,
              status: PaymentRefundStatus.PENDING,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'failed-refund',
              amountCents: 500,
              currency: 'USD',
              executionMode: RefundExecutionMode.STRIPE,
              status: PaymentRefundStatus.FAILED,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };
        mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
        mockPrismaService.payment.count.mockResolvedValue(1);

        const actualResult = await service.findAllForAdmin(25, 25);

        expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
          skip: 25,
          take: 25,
          select: expectedAdminPaymentSelect,
          orderBy: { createdAt: 'desc' },
        });
        expect(actualResult).toEqual({
          payments: [
            {
              ...mockPayment,
              paymentAmountCents: 12500,
              successfulRefundCents: 2500,
              pendingRefundCents: 1000,
              availableRefundCents: 9000,
              refundUnavailableReason: null,
              stripeRefundEligible: false,
            },
          ],
          total: 1,
        });
        expect(actualResult.payments[0]).not.toHaveProperty('idempotencyKey');
        expect(actualResult.payments[0]).not.toHaveProperty('providerRefId');
        expect(actualResult.payments[0]?.refunds[0]).not.toHaveProperty('idempotencyKey');
        expect(actualResult.payments[0]?.refunds[0]).not.toHaveProperty('processedByUserId');
        expect(actualResult.payments[0]?.refunds[0]).not.toHaveProperty('providerRefundId');
        expect(actualResult.payments[0]?.refunds[0]).not.toHaveProperty('failureMessage');
      });

      it('should keep a legacy sub-cent payment visible but unavailable for refunds', async () => {
        const mockPayment = {
          id: 'legacy-precision-payment',
          amount: 10.001,
          currency: 'USD',
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.PAYPAL,
          externalMethod: null,
          externalReference: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'user-id',
          registrationId: null,
          user: {
            id: 'user-id',
            firstName: 'Legacy',
            lastName: 'Payment',
            email: 'legacy@example.com',
          },
          registration: null,
          refunds: [
            {
              id: 'succeeded-refund',
              amountCents: 600,
              currency: 'USD',
              executionMode: RefundExecutionMode.MANUAL,
              status: PaymentRefundStatus.SUCCEEDED,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'pending-refund',
              amountCents: 100,
              currency: 'USD',
              executionMode: RefundExecutionMode.STRIPE,
              status: PaymentRefundStatus.PENDING,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };
        mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
        mockPrismaService.payment.count.mockResolvedValue(1);

        const actualResult = await service.findAllForAdmin();

        expect(actualResult).toEqual({
          payments: [
            {
              ...mockPayment,
              paymentAmountCents: null,
              successfulRefundCents: 600,
              pendingRefundCents: 100,
              availableRefundCents: 0,
              refundUnavailableReason:
                'Refund unavailable because the stored payment amount has unsupported precision.',
              stripeRefundEligible: false,
            },
          ],
          total: 1,
        });
      });

      it('should report a zero-dollar comp payment as exactly zero cents', async () => {
        const mockPayment = {
          id: 'zero-dollar-payment',
          amount: 0,
          currency: 'USD',
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.MANUAL,
          externalMethod: null,
          externalReference: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'user-id',
          registrationId: null,
          user: {
            id: 'user-id',
            firstName: 'Comp',
            lastName: 'Registration',
            email: 'comp@example.com',
          },
          registration: null,
          refunds: [],
        };
        mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
        mockPrismaService.payment.count.mockResolvedValue(1);

        const actualResult = await service.findAllForAdmin();

        expect(actualResult.payments[0]).toEqual(
          expect.objectContaining({
            paymentAmountCents: 0,
            successfulRefundCents: 0,
            pendingRefundCents: 0,
            availableRefundCents: 0,
            refundUnavailableReason: null,
          })
        );
      });

      it('should report the maximum supported historical payment amount in cents', async () => {
        const mockPayment = {
          id: 'maximum-payment',
          amount: 21_474_836.47,
          currency: 'USD',
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          externalMethod: null,
          externalReference: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'user-id',
          registrationId: null,
          user: {
            id: 'user-id',
            firstName: 'Maximum',
            lastName: 'Payment',
            email: 'maximum@example.com',
          },
          registration: null,
          refunds: [],
        };
        mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
        mockPrismaService.payment.count.mockResolvedValue(1);

        const actualResult = await service.findAllForAdmin();

        expect(actualResult.payments[0]).toEqual(
          expect.objectContaining({
            paymentAmountCents: 2_147_483_647,
            successfulRefundCents: 0,
            pendingRefundCents: 0,
            availableRefundCents: 2_147_483_647,
            refundUnavailableReason: null,
          })
        );
      });

      it('should keep an out-of-range payment visible with durable refund totals', async () => {
        const mockPayment = {
          id: 'out-of-range-payment',
          amount: 21_474_836.48,
          currency: 'USD',
          status: PaymentStatus.PARTIALLY_REFUNDED,
          provider: PaymentProvider.STRIPE,
          externalMethod: null,
          externalReference: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'user-id',
          registrationId: null,
          user: {
            id: 'user-id',
            firstName: 'Out Of Range',
            lastName: 'Payment',
            email: 'out-of-range@example.com',
          },
          registration: null,
          refunds: [
            {
              id: 'succeeded-refund',
              amountCents: 600,
              currency: 'USD',
              executionMode: RefundExecutionMode.MANUAL,
              status: PaymentRefundStatus.SUCCEEDED,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'pending-refund',
              amountCents: 100,
              currency: 'USD',
              executionMode: RefundExecutionMode.STRIPE,
              status: PaymentRefundStatus.PENDING,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };
        mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
        mockPrismaService.payment.count.mockResolvedValue(1);

        const actualResult = await service.findAllForAdmin();

        expect(actualResult.payments[0]).toEqual(
          expect.objectContaining({
            paymentAmountCents: null,
            successfulRefundCents: 600,
            pendingRefundCents: 100,
            availableRefundCents: 0,
            refundUnavailableReason:
              'Refund unavailable because the stored payment amount is invalid or exceeds the supported refund range.',
          })
        );
      });

      it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
        'should keep invalid stored payment amount %s visible but unavailable',
        async amount => {
          const mockPayment = {
            id: 'invalid-amount-payment',
            amount,
            currency: 'USD',
            status: PaymentStatus.COMPLETED,
            provider: PaymentProvider.PAYPAL,
            externalMethod: null,
            externalReference: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            userId: 'user-id',
            registrationId: null,
            user: {
              id: 'user-id',
              firstName: 'Invalid',
              lastName: 'Payment',
              email: 'invalid@example.com',
            },
            registration: null,
            refunds: [],
          };
          mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
          mockPrismaService.payment.count.mockResolvedValue(1);

          const actualResult = await service.findAllForAdmin();

          expect(actualResult.payments[0]).toEqual(
            expect.objectContaining({
              paymentAmountCents: null,
              successfulRefundCents: 0,
              pendingRefundCents: 0,
              availableRefundCents: 0,
              refundUnavailableReason:
                'Refund unavailable because the stored payment amount is invalid or exceeds the supported refund range.',
            })
          );
        }
      );

      it('should keep a malformed stored currency visible but unavailable for refunds', async () => {
        const mockPayment = {
          id: 'legacy-currency-payment',
          amount: 0,
          currency: 'usd',
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.PAYPAL,
          externalMethod: null,
          externalReference: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'user-id',
          registrationId: null,
          user: {
            id: 'user-id',
            firstName: 'Legacy',
            lastName: 'Currency',
            email: 'legacy@example.com',
          },
          registration: null,
          refunds: [],
        };
        mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
        mockPrismaService.payment.count.mockResolvedValue(1);

        const actualResult = await service.findAllForAdmin();

        expect(actualResult).toEqual({
          payments: [
            {
              ...mockPayment,
              paymentAmountCents: 0,
              successfulRefundCents: 0,
              pendingRefundCents: 0,
              availableRefundCents: 0,
              refundUnavailableReason:
                'Refund unavailable because the stored payment currency is invalid.',
              stripeRefundEligible: false,
            },
          ],
          total: 1,
        });
      });

      it('should report durable refund totals for a refunded payment with ledger rows', async () => {
        const mockPayment = {
          id: 'ledger-backed-refunded-payment',
          amount: 125,
          currency: 'USD',
          status: PaymentStatus.REFUNDED,
          provider: PaymentProvider.STRIPE,
          externalMethod: null,
          externalReference: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'user-id',
          registrationId: null,
          user: {
            id: 'user-id',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
          registration: null,
          refunds: [
            {
              id: 'succeeded-refund',
              amountCents: 10000,
              currency: 'USD',
              executionMode: RefundExecutionMode.MANUAL,
              status: PaymentRefundStatus.SUCCEEDED,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'pending-refund',
              amountCents: 2500,
              currency: 'USD',
              executionMode: RefundExecutionMode.STRIPE,
              status: PaymentRefundStatus.PENDING,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };
        mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
        mockPrismaService.payment.count.mockResolvedValue(1);

        const actualResult = await service.findAllForAdmin();

        expect(actualResult.payments[0]).toEqual(
          expect.objectContaining({
            paymentAmountCents: 12500,
            successfulRefundCents: 10000,
            pendingRefundCents: 2500,
            availableRefundCents: 0,
            refundUnavailableReason: null,
          })
        );
      });

      it('should preserve durable refund totals for a refunded payment with invalid currency', async () => {
        const mockPayment = {
          id: 'invalid-currency-ledger-backed-refunded-payment',
          amount: 125,
          currency: 'usd',
          status: PaymentStatus.REFUNDED,
          provider: PaymentProvider.STRIPE,
          externalMethod: null,
          externalReference: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'user-id',
          registrationId: null,
          user: {
            id: 'user-id',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
          registration: null,
          refunds: [
            {
              id: 'succeeded-refund',
              amountCents: 10000,
              currency: 'USD',
              executionMode: RefundExecutionMode.MANUAL,
              status: PaymentRefundStatus.SUCCEEDED,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'pending-refund',
              amountCents: 2500,
              currency: 'USD',
              executionMode: RefundExecutionMode.STRIPE,
              status: PaymentRefundStatus.PENDING,
              reason: null,
              externalReference: null,
              resultingRegistrationStatus: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };
        mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
        mockPrismaService.payment.count.mockResolvedValue(1);

        const actualResult = await service.findAllForAdmin();

        expect(actualResult.payments[0]).toEqual(
          expect.objectContaining({
            paymentAmountCents: 12500,
            successfulRefundCents: 10000,
            pendingRefundCents: 2500,
            availableRefundCents: 0,
            refundUnavailableReason:
              'Refund unavailable because the stored payment currency is invalid.',
          })
        );
      });

      it('should report legacy ledgerless refunded payments as fully refunded', async () => {
        const mockPayment = {
          id: 'legacy-refunded-payment',
          amount: 125,
          currency: 'USD',
          status: PaymentStatus.REFUNDED,
          provider: PaymentProvider.STRIPE,
          externalMethod: null,
          externalReference: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'user-id',
          registrationId: null,
          user: {
            id: 'user-id',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
          registration: null,
          refunds: [],
        };
        mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
        mockPrismaService.payment.count.mockResolvedValue(1);

        const actualResult = await service.findAllForAdmin();

        expect(actualResult.payments[0]).toEqual(
          expect.objectContaining({
            paymentAmountCents: 12500,
            successfulRefundCents: 12500,
            pendingRefundCents: 0,
            availableRefundCents: 0,
            refundUnavailableReason: null,
            refunds: [],
          })
        );
      });

      it.each([
        [-1, 25],
        [0.5, 25],
        [0, 0],
        [0, 101],
        [0, 1.5],
      ])('should reject invalid pagination skip=%s take=%s', async (skip, take) => {
        await expect(service.findAllForAdmin(skip, take)).rejects.toThrow(BadRequestException);
        expect(mockPrismaService.payment.findMany).not.toHaveBeenCalled();
      });
    });

    it('should select only pre-foundation payment fields and relations', async () => {
      const mockPayment = {
        id: 'payment-1',
        amount: 100,
        currency: 'USD',
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'provider-reference',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-id',
        registrationId: null,
        user: {
          id: 'user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        },
        registration: null,
      };
      mockPrismaService.payment.findMany.mockResolvedValue([mockPayment]);
      mockPrismaService.payment.count.mockResolvedValue(1);

      const actualResult = await service.findAll(0, 10, 'user-id');

      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        skip: 0,
        take: 10,
        select: expectedSharedPaymentSelect,
        orderBy: { createdAt: 'desc' },
      });
      expect(actualResult.payments[0]).not.toHaveProperty('externalMethod');
      expect(actualResult.payments[0]).not.toHaveProperty('externalReference');
      expect(actualResult.payments[0]).not.toHaveProperty('idempotencyKey');
      expect(actualResult.payments[0]).not.toHaveProperty('refunds');
    });

    it('should apply filters when provided', async () => {
      // Mock data
      const mockPayments = [{ id: 'payment-1', amount: 100 }];
      const mockTotal = 1;
      const userId = 'user-id';
      const status = PaymentStatus.COMPLETED;

      // Setup mocks
      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(mockTotal);

      // Execute
      const result = await service.findAll(0, 10, userId, status);

      // Assert
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, status },
        })
      );
      expect(mockPrismaService.payment.count).toHaveBeenCalledWith({
        where: { userId, status },
      });
      expect(result).toEqual({ payments: mockPayments, total: mockTotal });
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

  describe('findOneWithOwnershipCheck', () => {
    it('should select only pre-foundation payment fields and relations', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 100,
        currency: 'USD',
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'provider-reference',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-id',
        registrationId: null,
        user: {
          id: 'user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        },
        registration: null,
      };
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      const actualPayment = await service.findOneWithOwnershipCheck(
        'payment-id',
        'user-id',
        UserRole.PARTICIPANT
      );

      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        select: expectedSharedPaymentSelect,
      });
      expect(actualPayment).not.toHaveProperty('externalMethod');
      expect(actualPayment).not.toHaveProperty('externalReference');
      expect(actualPayment).not.toHaveProperty('idempotencyKey');
      expect(actualPayment).not.toHaveProperty('refunds');
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
      paymentDeferred: false,
      year: 2024,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      mockPrismaService.payment.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.registration.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        registration: mockRegistration,
      });
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

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(paymentWithRegistration);
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentWithRegistration);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);

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
      expect(mockPrismaService.payment.updateMany).toHaveBeenCalledWith({
        where: { id: mockPayment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.COMPLETED },
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();

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
      mockPrismaService.payment.findUnique.mockResolvedValue(completedPayment);
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

    it('should surface database transaction errors without an unguarded payment fallback', async () => {
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

      await expect(service.verifyStripeSession(sessionId)).rejects.toThrow(
        'Failed to verify Stripe session'
      );

      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).toHaveBeenCalledWith(sessionId);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();

      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.updateMany).not.toHaveBeenCalled();
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

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(partialCompletePayment);
      mockPrismaService.payment.findUnique.mockResolvedValue(partialCompletePayment);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);
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

    it.each([
      [PaymentStatus.FAILED, RegistrationStatus.CANCELLED],
      [PaymentStatus.PARTIALLY_REFUNDED, RegistrationStatus.PENDING],
      [PaymentStatus.REFUNDED, RegistrationStatus.WAITLISTED],
    ])(
      'should preserve terminal payment %s and current registration %s on paid-session replay',
      async (paymentStatus, registrationStatus) => {
        const terminalPayment = {
          ...mockPayment,
          status: paymentStatus,
          registration: {
            ...mockRegistration,
            status: registrationStatus,
            paymentDeferred: false,
          },
        };
        mockPrismaService.payment.findFirst.mockResolvedValue(terminalPayment);
        mockPrismaService.payment.findUnique.mockResolvedValue(terminalPayment);
        mockStripeService.getCheckoutSession.mockResolvedValue({
          id: sessionId,
          status: 'complete',
          payment_status: 'paid',
        });

        const actualResult = await service.verifyStripeSession(sessionId);

        expect(actualResult.paymentStatus).toBe(paymentStatus);
        expect(actualResult.registrationStatus).toBe(registrationStatus);
        expect(mockPrismaService.payment.updateMany).not.toHaveBeenCalled();
        expect(mockPrismaService.registration.updateMany).not.toHaveBeenCalled();
        expect(mockNotificationsService.sendRegistrationConfirmationEmail).not.toHaveBeenCalled();
      }
    );

    it('should preserve a current non-deferred registration on completed-session replay', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        registration: {
          ...mockRegistration,
          status: RegistrationStatus.PENDING,
          paymentDeferred: false,
        },
      };
      mockPrismaService.payment.findFirst.mockResolvedValue(completedPayment);
      mockPrismaService.payment.findUnique.mockResolvedValue(completedPayment);
      mockStripeService.getCheckoutSession.mockResolvedValue({
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
      });

      const actualResult = await service.verifyStripeSession(sessionId);

      expect(actualResult.paymentStatus).toBe(PaymentStatus.COMPLETED);
      expect(actualResult.registrationStatus).toBe(RegistrationStatus.PENDING);
      expect(mockPrismaService.payment.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      RegistrationStatus.CANCELLED,
      RegistrationStatus.APPLICATION_SUBMITTED,
      RegistrationStatus.APPLICATION_APPROVED,
      RegistrationStatus.APPLICATION_DECLINED,
    ])(
      'should complete a genuinely pending payment without changing protected registration %s',
      async protectedStatus => {
        const paymentWithProtectedRegistration = {
          ...mockPayment,
          registration: {
            ...mockRegistration,
            status: protectedStatus,
            paymentDeferred: true,
          },
        };
        mockPrismaService.payment.findFirst.mockResolvedValue(paymentWithProtectedRegistration);
        mockPrismaService.payment.findUnique.mockResolvedValue(paymentWithProtectedRegistration);
        mockStripeService.getCheckoutSession.mockResolvedValue({
          id: sessionId,
          status: 'complete',
          payment_status: 'paid',
        });

        const actualResult = await service.verifyStripeSession(sessionId);

        expect(mockPrismaService.payment.updateMany).toHaveBeenCalledWith({
          where: { id: mockPayment.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.COMPLETED },
        });
        expect(mockPrismaService.registration.updateMany).not.toHaveBeenCalled();
        expect(actualResult.paymentStatus).toBe(PaymentStatus.COMPLETED);
        expect(actualResult.registrationStatus).toBe(protectedStatus);
      }
    );

    it('should preserve a concurrent refund-derived payment transition during paid verification', async () => {
      const concurrentPayment = {
        ...mockPayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        registration: {
          ...mockRegistration,
          paymentDeferred: false,
        },
      };
      mockPrismaService.payment.findFirst.mockResolvedValue({
        ...mockPayment,
        registration: { ...mockRegistration, paymentDeferred: false },
      });
      mockPrismaService.payment.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({
          ...mockPayment,
          registration: { ...mockRegistration, paymentDeferred: true },
        })
        .mockResolvedValueOnce(concurrentPayment);
      mockStripeService.getCheckoutSession.mockResolvedValue({
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
      });

      const actualResult = await service.verifyStripeSession(sessionId);

      expect(actualResult.paymentStatus).toBe(PaymentStatus.PARTIALLY_REFUNDED);
      expect(mockPrismaService.registration.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
    });

    it('should preserve a concurrent protected registration transition during paid verification', async () => {
      const concurrentPayment = {
        ...mockPayment,
        registration: {
          ...mockRegistration,
          status: RegistrationStatus.CANCELLED,
          paymentDeferred: true,
        },
      };
      mockPrismaService.payment.findFirst.mockResolvedValue({
        ...mockPayment,
        registration: { ...mockRegistration, paymentDeferred: true },
      });
      mockPrismaService.registration.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce({
          ...mockPayment,
          registration: { ...mockRegistration, paymentDeferred: true },
        })
        .mockResolvedValueOnce(concurrentPayment);
      mockStripeService.getCheckoutSession.mockResolvedValue({
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
      });

      const actualResult = await service.verifyStripeSession(sessionId);

      expect(actualResult.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(actualResult.registrationStatus).toBe(RegistrationStatus.CANCELLED);
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
    });
  });

  // Task 5.6: PaymentsService Unit Tests for processRefund
  describe('processRefund', () => {
    // Task 5.6.1: Test processRefund() successfully processes Stripe refunds with payment intent IDs
    it('should successfully process Stripe refunds with payment intent IDs', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 100.0, // $100.00 in dollars
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'pi_stripe123',
        userId: 'user-id',
        registrationId: 'registration-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: {
          id: 'registration-id',
          userId: 'user-id',
          status: 'CONFIRMED',
        },
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        reason: 'Customer requested refund',
      };

      const mockStripeRefund = {
        id: 're_stripe123',
        amount: 10000, // Stripe returns amount in cents
        status: 'succeeded',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockStripeService.createRefund.mockResolvedValue(mockStripeRefund);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      });
      mockPrismaService.registration.update.mockResolvedValue({
        ...mockPayment.registration,
        status: 'CANCELLED',
      });

      // Execute
      const result = await service.processRefund(mockRefundDto);

      // Assert
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          registration: true,
        },
      });
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'pi_stripe123',
        10000, // $100.00 converted to cents
        'Customer requested refund'
      );
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.REFUNDED },
      });
      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: 'registration-id' },
        data: { status: 'CANCELLED' },
      });
      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 100.0,
        providerRefundId: 're_stripe123',
        success: true,
      });
    });

    // Task 5.6.2: Test processRefund() converts checkout session IDs to payment intent IDs for Stripe
    it('should convert checkout session IDs to payment intent IDs for Stripe', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 75.0, // $75.00 in dollars
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'cs_test_session123', // Checkout session ID
        userId: 'user-id',
        registrationId: 'registration-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: {
          id: 'registration-id',
          userId: 'user-id',
          status: 'CONFIRMED',
        },
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        reason: 'Registration cancellation',
      };

      const mockStripeSession = {
        id: 'cs_test_session123',
        payment_intent: 'pi_converted123', // String payment intent ID
      };

      const mockStripeRefund = {
        id: 're_stripe456',
        amount: 7500, // Stripe returns amount in cents
        status: 'succeeded',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);
      mockStripeService.createRefund.mockResolvedValue(mockStripeRefund);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      });
      mockPrismaService.registration.update.mockResolvedValue({
        ...mockPayment.registration,
        status: 'CANCELLED',
      });

      // Execute
      const result = await service.processRefund(mockRefundDto);

      // Assert
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          registration: true,
        },
      });

      // Should call createRefund with checkout session ID, which internally converts to payment intent
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'cs_test_session123', // The original checkout session ID
        7500, // $75.00 converted to cents
        'Registration cancellation'
      );

      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 75.0,
        providerRefundId: 're_stripe456',
        success: true,
      });
    });

    // Task 5.6.3: Test processRefund() maps custom refund reasons to valid Stripe reasons
    it('should map custom refund reasons to valid Stripe reasons', async () => {
      const basePayment = {
        id: 'payment-id',
        amount: 50.0,
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'pi_test123',
        userId: 'user-id',
        registrationId: 'registration-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: {
          id: 'registration-id',
          userId: 'user-id',
          status: 'CONFIRMED',
        },
      };

      const mockStripeRefund = {
        id: 're_test123',
        amount: 5000,
        status: 'succeeded',
      };

      // Setup base mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(basePayment);
      mockStripeService.createRefund.mockResolvedValue(mockStripeRefund);
      mockPrismaService.payment.update.mockResolvedValue({
        ...basePayment,
        status: PaymentStatus.REFUNDED,
      });
      mockPrismaService.registration.update.mockResolvedValue({
        ...basePayment.registration,
        status: 'CANCELLED',
      });

      // Test cases for reason mapping
      const testCases = [
        {
          inputReason: 'Duplicate payment detected',
          description: 'duplicate reason',
        },
        {
          inputReason: 'Fraudulent transaction',
          description: 'fraudulent reason',
        },
        {
          inputReason: 'Registration cancellation by admin',
          description: 'general reason (maps to requested_by_customer)',
        },
        {
          inputReason: 'Customer requested refund',
          description: 'customer request reason',
        },
      ];

      for (const testCase of testCases) {
        // Clear previous calls
        jest.clearAllMocks();

        // Setup mocks again
        mockPrismaService.payment.findUnique.mockResolvedValue(basePayment);
        mockStripeService.createRefund.mockResolvedValue(mockStripeRefund);
        mockPrismaService.payment.update.mockResolvedValue({
          ...basePayment,
          status: PaymentStatus.REFUNDED,
        });
        mockPrismaService.registration.update.mockResolvedValue({
          ...basePayment.registration,
          status: 'CANCELLED',
        });

        const refundDto = {
          paymentId: 'payment-id',
          reason: testCase.inputReason,
        };

        // Execute
        const result = await service.processRefund(refundDto);

        // Assert
        expect(mockStripeService.createRefund).toHaveBeenCalledWith(
          'pi_test123',
          5000, // $50.00 converted to cents
          testCase.inputReason // The original reason is passed through - mapping happens in StripeService
        );

        expect(result).toEqual({
          paymentId: 'payment-id',
          refundAmount: 50.0,
          providerRefundId: 're_test123',
          success: true,
        });
      }
    });

    // Test refund without reason
    it('should handle refund without reason provided', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 25.0,
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'pi_noreason123',
        userId: 'user-id',
        registrationId: 'registration-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: {
          id: 'registration-id',
          userId: 'user-id',
          status: 'CONFIRMED',
        },
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        // No reason provided
      };

      const mockStripeRefund = {
        id: 're_noreason123',
        amount: 2500,
        status: 'succeeded',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockStripeService.createRefund.mockResolvedValue(mockStripeRefund);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      });
      mockPrismaService.registration.update.mockResolvedValue({
        ...mockPayment.registration,
        status: 'CANCELLED',
      });

      // Execute
      const result = await service.processRefund(mockRefundDto);

      // Assert - should call createRefund with undefined reason
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'pi_noreason123',
        2500, // $25.00 converted to cents
        undefined // No reason provided
      );

      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 25.0,
        providerRefundId: 're_noreason123',
        success: true,
      });
    });

    // Task 5.6.4: Test processRefund() handles PayPal refunds with dollar amounts
    it('should handle PayPal refunds with dollar amounts', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 150.0, // $150.00 in dollars
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.PAYPAL,
        providerRefId: 'PAYID-PAYPAL123',
        userId: 'user-id',
        registrationId: 'registration-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: {
          id: 'registration-id',
          userId: 'user-id',
          status: 'CONFIRMED',
        },
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        reason: 'Event cancellation',
      };

      const mockPaypalRefund = {
        id: 'REFUND-PAYPAL123',
        amount: {
          currency_code: 'USD',
          value: '150.00', // PayPal returns amount as string with decimals
        },
        status: 'COMPLETED',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPaypalService.createRefund.mockResolvedValue(mockPaypalRefund);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      });
      mockPrismaService.registration.update.mockResolvedValue({
        ...mockPayment.registration,
        status: 'CANCELLED',
      });

      // Execute
      const result = await service.processRefund(mockRefundDto);

      // Assert
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          registration: true,
        },
      });

      // PayPal service should be called with dollar amount (not cents)
      expect(mockPaypalService.createRefund).toHaveBeenCalledWith(
        'PAYID-PAYPAL123',
        150.0, // $150.00 as dollars (not converted to cents like Stripe)
        'Event cancellation'
      );

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.REFUNDED },
      });

      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: 'registration-id' },
        data: { status: 'CANCELLED' },
      });

      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 150.0,
        providerRefundId: 'REFUND-PAYPAL123',
        success: true,
      });
    });

    // Test PayPal refund without registration
    it('should handle PayPal refunds without registration', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 75.5,
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.PAYPAL,
        providerRefId: 'PAYID-NOREG123',
        userId: 'user-id',
        registrationId: null, // No registration
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: null,
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        reason: 'Duplicate payment',
      };

      const mockPaypalRefund = {
        id: 'REFUND-NOREG123',
        amount: {
          currency_code: 'USD',
          value: '75.50',
        },
        status: 'COMPLETED',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPaypalService.createRefund.mockResolvedValue(mockPaypalRefund);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      });

      // Execute
      const result = await service.processRefund(mockRefundDto);

      // Assert
      expect(mockPaypalService.createRefund).toHaveBeenCalledWith(
        'PAYID-NOREG123',
        75.5, // Dollar amount for PayPal
        'Duplicate payment'
      );

      // Should not call registration update when no registration
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();

      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 75.5,
        providerRefundId: 'REFUND-NOREG123',
        success: true,
      });
    });

    // Task 5.6.5: Test processRefund() handles MANUAL payment refunds with database-only updates
    it('should handle MANUAL payment refunds with database-only updates', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 200.0, // $200.00 in dollars
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.MANUAL, // Manual payment provider
        providerRefId: 'MANUAL-PAYMENT-123',
        userId: 'user-id',
        registrationId: 'registration-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: {
          id: 'registration-id',
          userId: 'user-id',
          status: 'CONFIRMED',
        },
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        reason: 'Manual refund requested by admin',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      });
      mockPrismaService.registration.update.mockResolvedValue({
        ...mockPayment.registration,
        status: 'CANCELLED',
      });

      // Execute
      const result = await service.processRefund(mockRefundDto);

      // Assert
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          registration: true,
        },
      });

      // Should NOT call any external payment provider APIs
      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
      expect(mockPaypalService.createRefund).not.toHaveBeenCalled();

      // Should update payment status to REFUNDED
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.REFUNDED },
      });

      // Should update registration status to CANCELLED
      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: 'registration-id' },
        data: { status: 'CANCELLED' },
      });

      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 200.0,
        providerRefundId: expect.stringMatching(/^manual-refund-\d+$/), // Generated manual refund ID
        success: true,
      });
    });

    // Test MANUAL refund without registration
    it('should handle MANUAL payment refunds without registration', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 50.0,
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.MANUAL,
        providerRefId: 'MANUAL-STANDALONE-456',
        userId: 'user-id',
        registrationId: null, // No registration
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: null,
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        reason: 'Administrative correction',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      });

      // Execute
      const result = await service.processRefund(mockRefundDto);

      // Assert
      // Should NOT call any external payment provider APIs
      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
      expect(mockPaypalService.createRefund).not.toHaveBeenCalled();

      // Should update payment status
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.REFUNDED },
      });

      // Should NOT call registration update when no registration
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();

      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 50.0,
        providerRefundId: expect.stringMatching(/^manual-refund-\d+$/), // Generated manual refund ID
        success: true,
      });
    });

    // Test MANUAL refund with zero amount
    it('should handle MANUAL payment refunds with zero amount', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 0.0, // Zero dollar payment (e.g., comp registration)
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.MANUAL,
        providerRefId: 'MANUAL-COMP-789',
        userId: 'user-id',
        registrationId: 'registration-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: {
          id: 'registration-id',
          userId: 'user-id',
          status: 'CONFIRMED',
        },
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        reason: 'Comp registration cancellation',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      });
      mockPrismaService.registration.update.mockResolvedValue({
        ...mockPayment.registration,
        status: 'CANCELLED',
      });

      // Execute
      const result = await service.processRefund(mockRefundDto);

      // Assert
      // Should NOT call any external payment provider APIs
      expect(mockStripeService.createRefund).not.toHaveBeenCalled();
      expect(mockPaypalService.createRefund).not.toHaveBeenCalled();

      // Should still update database records even for zero amount
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        data: { status: PaymentStatus.REFUNDED },
      });

      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: 'registration-id' },
        data: { status: 'CANCELLED' },
      });

      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 0.0,
        providerRefundId: expect.stringMatching(/^manual-refund-\d+$/), // Generated manual refund ID
        success: true,
      });
    });

    // Task 5.6.6: Test processRefund() correctly formats refund amounts for different providers
    describe('refund amount formatting', () => {
      it('should format Stripe refund amounts as cents', async () => {
        const mockPayment = {
          id: 'payment-id',
          amount: 123.45, // $123.45 in dollars
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_stripe123',
          userId: 'user-id',
          registrationId: 'registration-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          registration: {
            id: 'registration-id',
            userId: 'user-id',
            status: 'CONFIRMED',
          },
        };

        const mockRefundDto = {
          paymentId: 'payment-id',
          reason: 'Amount formatting test',
        };

        const mockStripeRefund = {
          id: 're_stripe123',
          amount: 12345, // Stripe returns amount in cents
          status: 'succeeded',
        };

        // Setup mocks
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
        mockStripeService.createRefund.mockResolvedValue(mockStripeRefund);
        mockPrismaService.payment.update.mockResolvedValue({
          ...mockPayment,
          status: PaymentStatus.REFUNDED,
        });
        mockPrismaService.registration.update.mockResolvedValue({
          ...mockPayment.registration,
          status: 'CANCELLED',
        });

        // Execute
        const result = await service.processRefund(mockRefundDto);

        // Assert - Stripe should receive amount in cents (123.45 * 100 = 12345)
        expect(mockStripeService.createRefund).toHaveBeenCalledWith(
          'pi_stripe123',
          12345, // $123.45 converted to cents
          'Amount formatting test'
        );

        expect(result).toEqual({
          paymentId: 'payment-id',
          refundAmount: 123.45, // Result should be in dollars
          providerRefundId: 're_stripe123',
          success: true,
        });
      });

      it('should format PayPal refund amounts as dollars', async () => {
        const mockPayment = {
          id: 'payment-id',
          amount: 87.65, // $87.65 in dollars
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.PAYPAL,
          providerRefId: 'PAYID-PAYPAL456',
          userId: 'user-id',
          registrationId: 'registration-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          registration: {
            id: 'registration-id',
            userId: 'user-id',
            status: 'CONFIRMED',
          },
        };

        const mockRefundDto = {
          paymentId: 'payment-id',
          reason: 'PayPal amount test',
        };

        const mockPaypalRefund = {
          id: 'REFUND-PAYPAL456',
          amount: {
            currency_code: 'USD',
            value: '87.65', // PayPal returns amount as string
          },
          status: 'COMPLETED',
        };

        // Setup mocks
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
        mockPaypalService.createRefund.mockResolvedValue(mockPaypalRefund);
        mockPrismaService.payment.update.mockResolvedValue({
          ...mockPayment,
          status: PaymentStatus.REFUNDED,
        });
        mockPrismaService.registration.update.mockResolvedValue({
          ...mockPayment.registration,
          status: 'CANCELLED',
        });

        // Execute
        const result = await service.processRefund(mockRefundDto);

        // Assert - PayPal should receive amount in dollars (no conversion)
        expect(mockPaypalService.createRefund).toHaveBeenCalledWith(
          'PAYID-PAYPAL456',
          87.65, // $87.65 as dollars (no conversion)
          'PayPal amount test'
        );

        expect(result).toEqual({
          paymentId: 'payment-id',
          refundAmount: 87.65,
          providerRefundId: 'REFUND-PAYPAL456',
          success: true,
        });
      });

      it('should handle MANUAL payment amounts without external API calls', async () => {
        const mockPayment = {
          id: 'payment-id',
          amount: 99.99, // $99.99 in dollars
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.MANUAL,
          providerRefId: 'MANUAL-789',
          userId: 'user-id',
          registrationId: 'registration-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          registration: {
            id: 'registration-id',
            userId: 'user-id',
            status: 'CONFIRMED',
          },
        };

        const mockRefundDto = {
          paymentId: 'payment-id',
          reason: 'Manual amount test',
        };

        // Setup mocks
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
        mockPrismaService.payment.update.mockResolvedValue({
          ...mockPayment,
          status: PaymentStatus.REFUNDED,
        });
        mockPrismaService.registration.update.mockResolvedValue({
          ...mockPayment.registration,
          status: 'CANCELLED',
        });

        // Execute
        const result = await service.processRefund(mockRefundDto);

        // Assert - No external API calls for MANUAL payments
        expect(mockStripeService.createRefund).not.toHaveBeenCalled();
        expect(mockPaypalService.createRefund).not.toHaveBeenCalled();

        // Amount should be preserved as-is in result
        expect(result).toEqual({
          paymentId: 'payment-id',
          refundAmount: 99.99, // Amount preserved as dollars
          providerRefundId: expect.stringMatching(/^manual-refund-\d+$/),
          success: true,
        });
      });

      it('should handle decimal precision correctly for Stripe cents conversion', async () => {
        const testCases = [
          { dollars: 10.0, expectedCents: 1000 },
          { dollars: 10.01, expectedCents: 1001 },
          { dollars: 10.99, expectedCents: 1099 },
          { dollars: 0.01, expectedCents: 1 },
          { dollars: 999.99, expectedCents: 99999 },
        ];

        for (const testCase of testCases) {
          // Clear previous calls
          jest.clearAllMocks();

          const mockPayment = {
            id: 'payment-id',
            amount: testCase.dollars,
            status: PaymentStatus.COMPLETED,
            provider: PaymentProvider.STRIPE,
            providerRefId: 'pi_precision_test',
            userId: 'user-id',
            registrationId: 'registration-id',
            createdAt: new Date(),
            updatedAt: new Date(),
            registration: {
              id: 'registration-id',
              userId: 'user-id',
              status: 'CONFIRMED',
            },
          };

          const mockRefundDto = {
            paymentId: 'payment-id',
            reason: `Precision test for $${testCase.dollars}`,
          };

          const mockStripeRefund = {
            id: 're_precision_test',
            amount: testCase.expectedCents,
            status: 'succeeded',
          };

          // Setup mocks
          mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
          mockStripeService.createRefund.mockResolvedValue(mockStripeRefund);
          mockPrismaService.payment.update.mockResolvedValue({
            ...mockPayment,
            status: PaymentStatus.REFUNDED,
          });
          mockPrismaService.registration.update.mockResolvedValue({
            ...mockPayment.registration,
            status: 'CANCELLED',
          });

          // Execute
          await service.processRefund(mockRefundDto);

          // Assert precise conversion to cents
          expect(mockStripeService.createRefund).toHaveBeenCalledWith(
            'pi_precision_test',
            testCase.expectedCents,
            `Precision test for $${testCase.dollars}`
          );
        }
      });
    });

    // Task 5.6.7: Test processRefund() fails gracefully when Stripe session has no payment intent
    it('should fail gracefully when Stripe session has no payment intent', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 100.0,
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'cs_no_intent123', // Checkout session without payment intent
        userId: 'user-id',
        registrationId: 'registration-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: {
          id: 'registration-id',
          userId: 'user-id',
          status: 'CONFIRMED',
        },
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        reason: 'Session without payment intent test',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      // Mock StripeService to throw error when no payment intent exists
      mockStripeService.createRefund.mockRejectedValue(
        new Error('Checkout session cs_no_intent123 has no associated payment intent')
      );

      // Execute & Assert
      await expect(service.processRefund(mockRefundDto)).rejects.toThrow(
        'Checkout session cs_no_intent123 has no associated payment intent'
      );

      // Verify payment lookup occurred
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          registration: true,
        },
      });

      // Verify refund was attempted
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'cs_no_intent123',
        10000, // $100.00 converted to cents
        'Session without payment intent test'
      );

      // Verify database was NOT updated when refund fails
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
    });

    // Test checkout session with null payment intent
    it('should fail gracefully when Stripe session has null payment intent', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 75.0,
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'cs_null_intent456',
        userId: 'user-id',
        registrationId: 'registration-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: {
          id: 'registration-id',
          userId: 'user-id',
          status: 'CONFIRMED',
        },
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        reason: 'Null payment intent test',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      // Mock StripeService to throw specific error for null payment intent
      mockStripeService.createRefund.mockRejectedValue(
        new Error('Checkout session cs_null_intent456 has no associated payment intent')
      );

      // Execute & Assert
      await expect(service.processRefund(mockRefundDto)).rejects.toThrow(
        'Checkout session cs_null_intent456 has no associated payment intent'
      );

      // Verify correct API call was made
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'cs_null_intent456',
        7500, // $75.00 converted to cents
        'Null payment intent test'
      );

      // Verify no database updates on failure
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
    });

    // Test session that was never completed
    it('should fail gracefully when Stripe session was never completed', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 50.0,
        status: PaymentStatus.COMPLETED, // Payment marked complete but session wasn't
        provider: PaymentProvider.STRIPE,
        providerRefId: 'cs_incomplete789',
        userId: 'user-id',
        registrationId: null, // No registration for this payment
        createdAt: new Date(),
        updatedAt: new Date(),
        registration: null,
      };

      const mockRefundDto = {
        paymentId: 'payment-id',
        reason: 'Incomplete session test',
      };

      // Setup mocks
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      // Mock error for incomplete session
      mockStripeService.createRefund.mockRejectedValue(
        new Error('Checkout session cs_incomplete789 has no associated payment intent')
      );

      // Execute & Assert
      await expect(service.processRefund(mockRefundDto)).rejects.toThrow(
        'Checkout session cs_incomplete789 has no associated payment intent'
      );

      // Verify correct parameters
      expect(mockStripeService.createRefund).toHaveBeenCalledWith(
        'cs_incomplete789',
        5000, // $50.00 converted to cents
        'Incomplete session test'
      );

      // Verify no database updates
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
    });

    // Task 5.6.8: Test processRefund() handles Stripe API errors appropriately
    describe('Stripe API error handling', () => {
      it('should handle Stripe network errors appropriately', async () => {
        const mockPayment = {
          id: 'payment-id',
          amount: 125.0,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_network_error',
          userId: 'user-id',
          registrationId: 'registration-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          registration: {
            id: 'registration-id',
            userId: 'user-id',
            status: 'CONFIRMED',
          },
        };

        const mockRefundDto = {
          paymentId: 'payment-id',
          reason: 'Network error test',
        };

        // Setup mocks
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

        // Mock Stripe network error
        mockStripeService.createRefund.mockRejectedValue(
          new Error('Request failed with status code 500')
        );

        // Execute & Assert
        await expect(service.processRefund(mockRefundDto)).rejects.toThrow(
          'Request failed with status code 500'
        );

        // Verify refund was attempted
        expect(mockStripeService.createRefund).toHaveBeenCalledWith(
          'pi_network_error',
          12500, // $125.00 converted to cents
          'Network error test'
        );

        // Verify database was NOT updated when API fails
        expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
        expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      });

      it('should handle Stripe authentication errors appropriately', async () => {
        const mockPayment = {
          id: 'payment-id',
          amount: 200.0,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_auth_error',
          userId: 'user-id',
          registrationId: 'registration-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          registration: {
            id: 'registration-id',
            userId: 'user-id',
            status: 'CONFIRMED',
          },
        };

        const mockRefundDto = {
          paymentId: 'payment-id',
          reason: 'Auth error test',
        };

        // Setup mocks
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

        // Mock Stripe authentication error
        mockStripeService.createRefund.mockRejectedValue(new Error('Invalid API Key provided'));

        // Execute & Assert
        await expect(service.processRefund(mockRefundDto)).rejects.toThrow(
          'Invalid API Key provided'
        );

        expect(mockStripeService.createRefund).toHaveBeenCalledWith(
          'pi_auth_error',
          20000, // $200.00 converted to cents
          'Auth error test'
        );

        // Verify no database changes on auth failure
        expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
        expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      });

      it('should handle Stripe payment intent not found errors', async () => {
        const mockPayment = {
          id: 'payment-id',
          amount: 89.99,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_not_found',
          userId: 'user-id',
          registrationId: 'registration-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          registration: {
            id: 'registration-id',
            userId: 'user-id',
            status: 'CONFIRMED',
          },
        };

        const mockRefundDto = {
          paymentId: 'payment-id',
          reason: 'Payment intent not found test',
        };

        // Setup mocks
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

        // Mock Stripe payment intent not found error
        mockStripeService.createRefund.mockRejectedValue(
          new Error('No such payment_intent: pi_not_found')
        );

        // Execute & Assert
        await expect(service.processRefund(mockRefundDto)).rejects.toThrow(
          'No such payment_intent: pi_not_found'
        );

        expect(mockStripeService.createRefund).toHaveBeenCalledWith(
          'pi_not_found',
          8999, // $89.99 converted to cents
          'Payment intent not found test'
        );

        // Verify no database updates when payment intent doesn't exist
        expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
        expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      });

      it('should handle Stripe already refunded errors', async () => {
        const mockPayment = {
          id: 'payment-id',
          amount: 150.0,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_already_refunded',
          userId: 'user-id',
          registrationId: 'registration-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          registration: {
            id: 'registration-id',
            userId: 'user-id',
            status: 'CONFIRMED',
          },
        };

        const mockRefundDto = {
          paymentId: 'payment-id',
          reason: 'Already refunded test',
        };

        // Setup mocks
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

        // Mock Stripe already refunded error
        mockStripeService.createRefund.mockRejectedValue(
          new Error('This PaymentIntent has already been refunded.')
        );

        // Execute & Assert
        await expect(service.processRefund(mockRefundDto)).rejects.toThrow(
          'This PaymentIntent has already been refunded.'
        );

        expect(mockStripeService.createRefund).toHaveBeenCalledWith(
          'pi_already_refunded',
          15000, // $150.00 converted to cents
          'Already refunded test'
        );

        // Verify no database updates for already refunded payments
        expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
        expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      });

      it('should handle Stripe insufficient funds errors', async () => {
        const mockPayment = {
          id: 'payment-id',
          amount: 300.0,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_insufficient_funds',
          userId: 'user-id',
          registrationId: null, // No registration for this payment
          createdAt: new Date(),
          updatedAt: new Date(),
          registration: null,
        };

        const mockRefundDto = {
          paymentId: 'payment-id',
          reason: 'Insufficient funds test',
        };

        // Setup mocks
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

        // Mock Stripe insufficient funds error
        mockStripeService.createRefund.mockRejectedValue(
          new Error('Insufficient funds in Stripe account for refund')
        );

        // Execute & Assert
        await expect(service.processRefund(mockRefundDto)).rejects.toThrow(
          'Insufficient funds in Stripe account for refund'
        );

        expect(mockStripeService.createRefund).toHaveBeenCalledWith(
          'pi_insufficient_funds',
          30000, // $300.00 converted to cents
          'Insufficient funds test'
        );

        // Verify no database updates on insufficient funds
        expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
        expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      });

      it('should handle generic Stripe API errors', async () => {
        const mockPayment = {
          id: 'payment-id',
          amount: 99.0,
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'cs_generic_error',
          userId: 'user-id',
          registrationId: 'registration-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          registration: {
            id: 'registration-id',
            userId: 'user-id',
            status: 'CONFIRMED',
          },
        };

        const mockRefundDto = {
          paymentId: 'payment-id',
          reason: 'Generic error test',
        };

        // Setup mocks
        mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

        // Mock generic Stripe error
        mockStripeService.createRefund.mockRejectedValue(
          new Error('An unexpected error occurred while processing the refund')
        );

        // Execute & Assert
        await expect(service.processRefund(mockRefundDto)).rejects.toThrow(
          'An unexpected error occurred while processing the refund'
        );

        expect(mockStripeService.createRefund).toHaveBeenCalledWith(
          'cs_generic_error',
          9900, // $99.00 converted to cents
          'Generic error test'
        );

        // Verify no database updates on generic errors
        expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
        expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      });
    });
  });

  // Additional tests would follow the same pattern for other methods

  /**
   * Coverage for the deferred-payment side effects introduced with
   * issues #158/#159/#160:
   *
   *  - `verifyStripeSession` now clears `paymentDeferred` on the
   *    registration when the payment completes, even if status was
   *    already CONFIRMED (which is the deferred case).
   *  - external payments transactionally update registration state.
   */
  describe('deferred-payment side effects', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('clears paymentDeferred when verifyStripeSession lands a paid session on a deferred registration', async () => {
      // Deferred registration: CONFIRMED + paymentDeferred=true,
      // payment row still PENDING (it was created when the user clicked
      // Pay Now from the dashboard, then this verification runs after
      // checkout success).
      const deferredPayment = {
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
      };
      mockPrismaService.payment.findFirst.mockResolvedValueOnce(deferredPayment);
      mockPrismaService.payment.findUnique.mockResolvedValueOnce(deferredPayment);
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_deferred_session',
        status: 'complete',
        payment_status: 'paid',
      });

      await service.verifyStripeSession('cs_deferred_session');

      // The transaction body issues two prisma update calls; assert the
      // registration update sets both status and clears paymentDeferred.
      expect(mockPrismaService.registration.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'registration-id',
            paymentDeferred: true,
            status: 'CONFIRMED',
          },
          data: { status: 'CONFIRMED', paymentDeferred: false },
        })
      );
    });

    it('skips the post-payment confirmation email when paying off a deferred registration (already emailed at creation)', async () => {
      const deferredPayment = {
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
      };
      mockPrismaService.payment.findFirst.mockResolvedValueOnce(deferredPayment);
      mockPrismaService.payment.findUnique.mockResolvedValueOnce(deferredPayment);
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_deferred_pay',
        status: 'complete',
        payment_status: 'paid',
      });
      await service.verifyStripeSession('cs_deferred_pay');

      expect(mockPrismaService.registration.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'registration-id',
            paymentDeferred: true,
            status: 'CONFIRMED',
          },
          data: { status: 'CONFIRMED', paymentDeferred: false },
        })
      );
      expect(mockNotificationsService.sendRegistrationConfirmationEmail).not.toHaveBeenCalled();
    });

    it('still clears paymentDeferred on retry when payment is already COMPLETED but registration is still flagged deferred', async () => {
      // Edge case: previous run completed the payment update but the
      // registration update failed and is being retried. Without the
      // widened condition, this case would skip the update and leave
      // paymentDeferred=true forever.
      const deferredPayment = {
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
      };
      mockPrismaService.payment.findFirst.mockResolvedValueOnce(deferredPayment);
      mockPrismaService.payment.findUnique.mockResolvedValueOnce(deferredPayment);
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_deferred_retry',
        status: 'complete',
        payment_status: 'paid',
      });

      await service.verifyStripeSession('cs_deferred_retry');

      expect(mockPrismaService.registration.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'registration-id',
            paymentDeferred: true,
            status: 'CONFIRMED',
          },
          data: { status: 'CONFIRMED', paymentDeferred: false },
        })
      );
    });

    it('skips the update only when payment is COMPLETED AND registration is CONFIRMED AND paymentDeferred is false', async () => {
      const completedPayment = {
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
      };
      mockPrismaService.payment.findFirst.mockResolvedValueOnce(completedPayment);
      mockPrismaService.payment.findUnique.mockResolvedValueOnce(completedPayment);
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_already_done',
        status: 'complete',
        payment_status: 'paid',
      });

      await service.verifyStripeSession('cs_already_done');

      expect(mockPrismaService.registration.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.updateMany).not.toHaveBeenCalled();
    });

    it('does NOT promote a WAITLISTED deferred registration to CONFIRMED on payment — capacity wins', async () => {
      // Deferred + WAITLISTED participant pays via Pay Now CTA. The
      // payment must record + clear paymentDeferred, but the status
      // must stay WAITLISTED (admin / capacity-opens-up is the only path
      // to CONFIRMED for waitlisted registrations).
      const waitlistedPayment = {
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
      };
      mockPrismaService.payment.findFirst.mockResolvedValueOnce(waitlistedPayment);
      mockPrismaService.payment.findUnique.mockResolvedValueOnce(waitlistedPayment);
      mockStripeService.getCheckoutSession.mockResolvedValueOnce({
        id: 'cs_waitlisted_pay',
        status: 'complete',
        payment_status: 'paid',
      });

      await service.verifyStripeSession('cs_waitlisted_pay');

      expect(mockPrismaService.registration.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'registration-id',
            paymentDeferred: true,
            status: 'WAITLISTED',
          },
          data: { status: 'WAITLISTED', paymentDeferred: false },
        })
      );
    });
  });

  describe('recordExternalPayment', () => {
    const inputRequest = {
      registrationId: '6adf7e80-3035-4d12-a2d4-45c591bb2441',
      amount: 125.5,
      currency: 'usd',
      externalMethod: ExternalPaymentMethod.CHECK,
      externalReference: ' check-123 ',
      idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
    };

    const mockCreatedPayment = {
      id: 'payment-id',
      amount: 125.5,
      currency: 'USD',
      status: PaymentStatus.COMPLETED,
      provider: PaymentProvider.MANUAL,
      externalMethod: ExternalPaymentMethod.CHECK,
      externalReference: 'check-123',
      idempotencyKey: inputRequest.idempotencyKey,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'registration-owner-id',
      registrationId: inputRequest.registrationId,
      user: {
        id: 'registration-owner-id',
        firstName: 'Pat',
        lastName: 'Participant',
        email: 'pat@example.com',
      },
      registration: {
        id: inputRequest.registrationId,
        year: 2026,
        status: RegistrationStatus.CONFIRMED,
      },
      refunds: [],
    };

    beforeEach(() => {
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          callback(mockPrismaService)
      );
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      mockPrismaService.registration.findUnique.mockResolvedValue({
        id: inputRequest.registrationId,
        userId: 'registration-owner-id',
        status: RegistrationStatus.PENDING,
      });
      mockPrismaService.registration.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.payment.create.mockResolvedValue(mockCreatedPayment);
      mockPrismaService.adminAudit.create.mockResolvedValue({
        id: 'audit-id',
      });
    });

    it('should return bad request for an amount outside the safe cent range', async () => {
      let actualError: unknown;

      try {
        await service.recordExternalPayment(
          { ...inputRequest, amount: Number.MAX_SAFE_INTEGER },
          'admin-id'
        );
      } catch (error: unknown) {
        actualError = error;
      }

      expect(actualError).toBeInstanceOf(BadRequestException);
      if (!(actualError instanceof BadRequestException)) {
        throw actualError;
      }
      expect(actualError.getStatus()).toBe(400);
      expect(actualError.message).toBe('Dollar amount exceeds the supported range');
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should atomically derive the owner, create the payment, update registration, and audit', async () => {
      const actualPayment = await service.recordExternalPayment(inputRequest, 'admin-id');

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: inputRequest.registrationId },
        select: { id: true, userId: true, status: true },
      });
      expect(mockPrismaService.registration.updateMany).toHaveBeenCalledWith({
        where: {
          id: inputRequest.registrationId,
          status: RegistrationStatus.PENDING,
        },
        data: {
          status: RegistrationStatus.CONFIRMED,
          paymentDeferred: false,
        },
      });
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith({
        data: {
          amount: 125.5,
          currency: 'USD',
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.MANUAL,
          externalMethod: ExternalPaymentMethod.CHECK,
          externalReference: 'check-123',
          idempotencyKey: inputRequest.idempotencyKey,
          userId: 'registration-owner-id',
          registrationId: inputRequest.registrationId,
        },
        select: expectedExternalPaymentSelect,
      });
      expect(mockPrismaService.adminAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminUserId: 'admin-id',
          actionType: AdminAuditActionType.PAYMENT_EXTERNAL,
          targetRecordType: AdminAuditTargetType.PAYMENT,
          targetRecordId: 'payment-id',
          newValues: expect.objectContaining({
            registrationId: inputRequest.registrationId,
            amount: 125.5,
            currency: 'USD',
            externalMethod: ExternalPaymentMethod.CHECK,
            externalReference: 'check-123',
            previousRegistrationStatus: RegistrationStatus.PENDING,
            resultingRegistrationStatus: RegistrationStatus.CONFIRMED,
          }),
        }),
      });
      expect(actualPayment).not.toHaveProperty('idempotencyKey');
    });

    it.each([RegistrationStatus.WAITLISTED, RegistrationStatus.CONFIRMED])(
      'should preserve %s registration status',
      async inputStatus => {
        mockPrismaService.registration.findUnique.mockResolvedValue({
          id: inputRequest.registrationId,
          userId: 'registration-owner-id',
          status: inputStatus,
        });

        await service.recordExternalPayment(inputRequest, 'admin-id');

        expect(mockPrismaService.registration.updateMany).toHaveBeenCalledWith({
          where: {
            id: inputRequest.registrationId,
            status: inputStatus,
          },
          data: {
            status: inputStatus,
            paymentDeferred: false,
          },
        });
      }
    );

    it.each([
      RegistrationStatus.APPLICATION_SUBMITTED,
      RegistrationStatus.APPLICATION_APPROVED,
      RegistrationStatus.APPLICATION_DECLINED,
      RegistrationStatus.CANCELLED,
    ])('should reject ineligible registration status %s', async inputStatus => {
      mockPrismaService.registration.findUnique.mockResolvedValue({
        id: inputRequest.registrationId,
        userId: 'registration-owner-id',
        status: inputStatus,
      });

      await expect(service.recordExternalPayment(inputRequest, 'admin-id')).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrismaService.payment.create).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should return conflict when registration status changes concurrently', async () => {
      mockPrismaService.registration.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.recordExternalPayment(inputRequest, 'admin-id')).rejects.toThrow(
        ConflictException
      );
      expect(mockPrismaService.payment.create).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should return the original payment when an identical request loses the registration update race', async () => {
      mockPrismaService.registration.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCreatedPayment);

      const actualPayment = await service.recordExternalPayment(inputRequest, 'admin-id');

      expect(actualPayment.id).toBe(mockCreatedPayment.id);
      expect(actualPayment).not.toHaveProperty('idempotencyKey');
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.payment.create).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should return conflict when a different request loses the registration update race', async () => {
      mockPrismaService.registration.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCreatedPayment);

      await expect(
        service.recordExternalPayment({ ...inputRequest, amount: 126 }, 'admin-id')
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.payment.create).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should reject a missing registration', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(null);

      await expect(service.recordExternalPayment(inputRequest, 'admin-id')).rejects.toThrow(
        NotFoundException
      );
      expect(mockPrismaService.payment.create).not.toHaveBeenCalled();
    });

    it('should propagate an audit failure from the transaction', async () => {
      mockPrismaService.adminAudit.create.mockRejectedValue(new Error('Audit write failed'));

      await expect(service.recordExternalPayment(inputRequest, 'admin-id')).rejects.toThrow(
        'Audit write failed'
      );
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should return an identical retry without duplicate writes', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockCreatedPayment);

      const actualPayment = await service.recordExternalPayment(inputRequest, 'admin-id');

      expect(actualPayment.id).toBe('payment-id');
      expect(actualPayment).not.toHaveProperty('idempotencyKey');
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.create).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should return conflict when a key is reused with different input', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockCreatedPayment);

      await expect(
        service.recordExternalPayment({ ...inputRequest, amount: 126 }, 'admin-id')
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.payment.create).not.toHaveBeenCalled();
    });

    it('should resolve an identical concurrent unique-key race', async () => {
      mockPrismaService.$transaction.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['idempotencyKey'] },
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(mockCreatedPayment);

      const actualPayment = await service.recordExternalPayment(inputRequest, 'admin-id');

      expect(actualPayment.id).toBe('payment-id');
      expect(actualPayment).not.toHaveProperty('idempotencyKey');
    });

    it('should return conflict for a mismatched concurrent unique-key race', async () => {
      mockPrismaService.$transaction.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['idempotencyKey'] },
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(mockCreatedPayment);

      await expect(
        service.recordExternalPayment(
          { ...inputRequest, externalReference: 'different' },
          'admin-id'
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createManualRefund', () => {
    const paymentId = '5f8d0d55-e0a3-4cf0-a620-2412acd4361c';
    const idempotencyKey = '43ea4b84-1f0d-413d-bc1c-9c91b435d66d';
    const inputRequest = {
      amountCents: 2500,
      executionMode: RefundExecutionMode.MANUAL,
      reason: 'duplicate charge',
      externalReference: 'refund-123',
      idempotencyKey,
    };
    const createdRefund = {
      id: 'refund-id',
      paymentId,
      amountCents: 2500,
      currency: 'USD',
      executionMode: RefundExecutionMode.MANUAL,
      status: PaymentRefundStatus.SUCCEEDED,
      reason: 'duplicate charge',
      externalReference: 'refund-123',
      idempotencyKey,
      resultingRegistrationStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const publicCreatedRefund = {
      id: createdRefund.id,
      amountCents: createdRefund.amountCents,
      currency: createdRefund.currency,
      executionMode: createdRefund.executionMode,
      status: createdRefund.status,
      reason: createdRefund.reason,
      externalReference: createdRefund.externalReference,
      resultingRegistrationStatus: createdRefund.resultingRegistrationStatus,
      createdAt: createdRefund.createdAt,
      updatedAt: createdRefund.updatedAt,
    };
    type MockAdminRefund = Omit<
      typeof publicCreatedRefund,
      'status' | 'resultingRegistrationStatus'
    > & {
      status: PaymentRefundStatus;
      resultingRegistrationStatus: RegistrationStatus | null;
    };
    const basePayment = {
      id: paymentId,
      amount: 100,
      currency: 'USD',
      status: PaymentStatus.COMPLETED,
      provider: PaymentProvider.MANUAL,
      externalMethod: ExternalPaymentMethod.CHECK,
      externalReference: 'check-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-id',
      registrationId: 'registration-id',
      user: {
        id: 'user-id',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      },
      registration: {
        id: 'registration-id',
        year: 2026,
        status: RegistrationStatus.CONFIRMED,
      },
      refunds: [],
    };

    function buildUpdatedPayment(
      status: PaymentStatus,
      refunds: MockAdminRefund[] = [publicCreatedRefund],
      registrationStatus: RegistrationStatus = RegistrationStatus.CONFIRMED
    ) {
      return {
        ...basePayment,
        status,
        registration: {
          ...basePayment.registration,
          status: registrationStatus,
        },
        refunds,
      };
    }

    async function sanitizeRefundRequest(
      request: Record<string, unknown>
    ): Promise<CreateRefundDto> {
      const validationPipe = new GlobalValidationPipe();
      return validationPipe.transform(request, {
        type: 'body',
        metatype: CreateRefundDto,
      }) as Promise<CreateRefundDto>;
    }

    beforeEach(() => {
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          callback(mockPrismaService)
      );
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(null);
      mockPrismaService.paymentRefund.create.mockResolvedValue(createdRefund);
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce(buildUpdatedPayment(PaymentStatus.PARTIALLY_REFUNDED));
      mockPrismaService.payment.update.mockResolvedValue({
        ...basePayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
      });
      mockPrismaService.registration.update.mockResolvedValue(basePayment.registration);
      mockPrismaService.adminAudit.create.mockResolvedValue({ id: 'audit-id' });
      mockPrismaService.adminAudit.findFirst.mockResolvedValue({
        newValues: { requestedFullRefund: false },
      });
    });

    it('should create a succeeded partial refund with serializable isolation and atomic audit', async () => {
      const actualResult = await service.createManualRefund(paymentId, inputRequest, 'admin-id');

      expect(mockPrismaService.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      expect(mockPrismaService.payment.findUnique).toHaveBeenNthCalledWith(1, {
        where: { id: paymentId },
        select: expectedAdminPaymentSelect,
      });
      expect(mockPrismaService.paymentRefund.create).toHaveBeenCalledWith({
        data: {
          paymentId,
          amountCents: 2500,
          currency: 'USD',
          executionMode: RefundExecutionMode.MANUAL,
          status: PaymentRefundStatus.SUCCEEDED,
          reason: 'duplicate charge',
          externalReference: 'refund-123',
          idempotencyKey,
          processedByUserId: 'admin-id',
          resultingRegistrationStatus: null,
        },
        select: expect.objectContaining({
          id: true,
          paymentId: true,
          idempotencyKey: true,
        }),
      });
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: paymentId },
        data: { status: PaymentStatus.PARTIALLY_REFUNDED },
      });
      expect(mockPrismaService.adminAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminUserId: 'admin-id',
          actionType: AdminAuditActionType.PAYMENT_REFUND,
          targetRecordType: AdminAuditTargetType.PAYMENT,
          targetRecordId: paymentId,
          transactionId: idempotencyKey,
          newValues: expect.objectContaining({
            refundId: 'refund-id',
            registrationId: 'registration-id',
            amountCents: 2500,
            currency: 'USD',
            executionMode: RefundExecutionMode.MANUAL,
            requestedFullRefund: false,
          }),
        }),
      });
      expect(actualResult).toEqual(
        expect.objectContaining({
          refund: publicCreatedRefund,
          paymentAmountCents: 10000,
          successfulRefundCents: 2500,
          pendingRefundCents: 0,
          availableRefundCents: 7500,
        })
      );
    });

    it('should sum succeeded rows, reserve pending rows, and ignore failed rows', async () => {
      const existingRefunds = [
        {
          ...publicCreatedRefund,
          id: 'existing-success',
          amountCents: 2000,
        },
        {
          ...publicCreatedRefund,
          id: 'existing-pending',
          amountCents: 1000,
          status: PaymentRefundStatus.PENDING,
        },
        {
          ...publicCreatedRefund,
          id: 'existing-failed',
          amountCents: 5000,
          status: PaymentRefundStatus.FAILED,
        },
      ];
      const paymentWithRefunds = {
        ...basePayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunds: existingRefunds,
      };
      mockPrismaService.payment.findUnique
        .mockReset()
        .mockResolvedValueOnce(paymentWithRefunds)
        .mockResolvedValueOnce(
          buildUpdatedPayment(PaymentStatus.PARTIALLY_REFUNDED, [
            ...existingRefunds,
            publicCreatedRefund,
          ])
        );

      const actualResult = await service.createManualRefund(paymentId, inputRequest, 'admin-id');

      expect(actualResult.successfulRefundCents).toBe(4500);
      expect(actualResult.pendingRefundCents).toBe(1000);
      expect(actualResult.availableRefundCents).toBe(4500);
    });

    it('should allow multiple refunds to reach exactly full', async () => {
      const existingRefund = {
        ...publicCreatedRefund,
        id: 'existing-refund',
        amountCents: 7500,
      };
      const paymentWithRefund = {
        ...basePayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunds: [existingRefund],
      };
      mockPrismaService.payment.findUnique
        .mockReset()
        .mockResolvedValueOnce(paymentWithRefund)
        .mockResolvedValueOnce(
          buildUpdatedPayment(PaymentStatus.REFUNDED, [existingRefund, publicCreatedRefund])
        );

      const actualResult = await service.createManualRefund(paymentId, inputRequest, 'admin-id');

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: paymentId },
        data: { status: PaymentStatus.REFUNDED },
      });
      expect(actualResult.payment.status).toBe(PaymentStatus.REFUNDED);
      expect(actualResult.successfulRefundCents).toBe(10000);
      expect(actualResult.availableRefundCents).toBe(0);
    });

    it('should use the exact available balance for a full refund and apply an allowed registration status', async () => {
      const fullRefund = {
        ...createdRefund,
        amountCents: 8000,
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
      };
      const publicFullRefund = {
        ...publicCreatedRefund,
        amountCents: 8000,
        resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
      };
      const existingRefund = {
        ...publicCreatedRefund,
        id: 'existing-refund',
        amountCents: 2000,
      };
      mockPrismaService.paymentRefund.create.mockResolvedValue(fullRefund);
      mockPrismaService.payment.findUnique
        .mockReset()
        .mockResolvedValueOnce({
          ...basePayment,
          status: PaymentStatus.PARTIALLY_REFUNDED,
          refunds: [existingRefund],
        })
        .mockResolvedValueOnce(
          buildUpdatedPayment(
            PaymentStatus.REFUNDED,
            [existingRefund, publicFullRefund],
            RegistrationStatus.WAITLISTED
          )
        );

      const actualResult = await service.createManualRefund(
        paymentId,
        {
          fullRefund: true,
          executionMode: RefundExecutionMode.MANUAL,
          resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
          idempotencyKey,
        },
        'admin-id'
      );

      expect(mockPrismaService.paymentRefund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amountCents: 8000 }),
        })
      );
      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: 'registration-id' },
        data: { status: RegistrationStatus.WAITLISTED },
      });
      expect(actualResult.payment.registration?.status).toBe(RegistrationStatus.WAITLISTED);
      expect(actualResult.availableRefundCents).toBe(0);
    });

    it('should reject an over-refund without ledger, payment, registration, or audit writes', async () => {
      await expect(
        service.createManualRefund(paymentId, { ...inputRequest, amountCents: 10001 }, 'admin-id')
      ).rejects.toThrow('exceeds available balance of 10000 cents');

      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should reject explicit cents above the PostgreSQL INTEGER range before the transaction', async () => {
      await expect(
        service.createManualRefund(
          paymentId,
          { ...inputRequest, amountCents: 2_147_483_648 },
          'admin-id'
        )
      ).rejects.toThrow('supported range');

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should reject a full refund for an oversized historical payment before writes', async () => {
      mockPrismaService.payment.findUnique.mockReset().mockResolvedValue({
        ...basePayment,
        amount: 21_474_836.48,
      });

      await expect(
        service.createManualRefund(
          paymentId,
          {
            fullRefund: true,
            executionMode: RefundExecutionMode.MANUAL,
            idempotencyKey,
          },
          'admin-id'
        )
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should reject manual refunds for a stored payment with sub-cent precision', async () => {
      mockPrismaService.payment.findUnique
        .mockReset()
        .mockResolvedValue({ ...basePayment, amount: 10.001 });

      await expect(
        service.createManualRefund(paymentId, inputRequest, 'admin-id')
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should persist canonical text at the exact post-sanitization limits', async () => {
      const sanitizedRequest = await sanitizeRefundRequest({
        ...inputRequest,
        reason: '&'.repeat(100),
        externalReference: '&'.repeat(51),
      });

      await service.createManualRefund(paymentId, sanitizedRequest, 'admin-id');

      expect(sanitizedRequest.reason).toHaveLength(500);
      expect(sanitizedRequest.externalReference).toHaveLength(255);
      expect(mockPrismaService.paymentRefund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: sanitizedRequest.reason,
            externalReference: sanitizedRequest.externalReference,
          }),
        })
      );
      expect(mockPrismaService.adminAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          newValues: expect.objectContaining({
            reason: sanitizedRequest.reason,
            externalReference: sanitizedRequest.externalReference,
          }),
        }),
      });
    });

    it.each([
      ['reason', '&'.repeat(101), 500],
      ['externalReference', '&'.repeat(52), 255],
    ] as const)(
      'should reject %s that exceeds its persistence limit after sanitization',
      async (field, rawValue, expectedLimit) => {
        const sanitizedRequest = await sanitizeRefundRequest({
          ...inputRequest,
          [field]: rawValue,
        });

        await expect(
          service.createManualRefund(paymentId, sanitizedRequest, 'admin-id')
        ).rejects.toThrow(`${field} must not exceed ${expectedLimit} characters`);

        expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
        expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
        expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
        expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
        expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
      }
    );

    it('should reject manual refunds for an invalid stored currency before writes', async () => {
      mockPrismaService.payment.findUnique
        .mockReset()
        .mockResolvedValue({ ...basePayment, currency: 'usd' });

      await expect(
        service.createManualRefund(paymentId, inputRequest, 'admin-id')
      ).rejects.toThrow('Refund unavailable because the stored payment currency is invalid.');

      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should allow a payment without registration but reject a requested registration status', async () => {
      const unlinkedPayment = {
        ...basePayment,
        registrationId: null,
        registration: null,
      };
      mockPrismaService.payment.findUnique
        .mockReset()
        .mockResolvedValueOnce(unlinkedPayment)
        .mockResolvedValueOnce({
          ...buildUpdatedPayment(PaymentStatus.PARTIALLY_REFUNDED),
          registrationId: null,
          registration: null,
        });

      await expect(
        service.createManualRefund(paymentId, inputRequest, 'admin-id')
      ).resolves.toEqual(expect.objectContaining({ successfulRefundCents: 2500 }));
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();

      jest.clearAllMocks();
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          callback(mockPrismaService)
      );
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(null);
      mockPrismaService.payment.findUnique.mockResolvedValue(unlinkedPayment);

      await expect(
        service.createManualRefund(
          paymentId,
          {
            ...inputRequest,
            resultingRegistrationStatus: RegistrationStatus.PENDING,
          },
          'admin-id'
        )
      ).rejects.toThrow('payment without a registration');
    });

    it.each([
      RegistrationStatus.CANCELLED,
      RegistrationStatus.APPLICATION_SUBMITTED,
      RegistrationStatus.APPLICATION_APPROVED,
      RegistrationStatus.APPLICATION_DECLINED,
    ])('should reject resulting status %s with cancellation guidance', async inputStatus => {
      await expect(
        service.createManualRefund(
          paymentId,
          {
            ...inputRequest,
            resultingRegistrationStatus: inputStatus,
          },
          'admin-id'
        )
      ).rejects.toThrow('use the cancellation workflow');
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      RegistrationStatus.CANCELLED,
      RegistrationStatus.APPLICATION_SUBMITTED,
      RegistrationStatus.APPLICATION_APPROVED,
      RegistrationStatus.APPLICATION_DECLINED,
    ])(
      'should reject a registration status change when the current status is %s',
      async currentStatus => {
        mockPrismaService.payment.findUnique.mockReset().mockResolvedValue({
          ...basePayment,
          registration: {
            ...basePayment.registration,
            status: currentStatus,
          },
        });

        await expect(
          service.createManualRefund(
            paymentId,
            {
              ...inputRequest,
              resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
            },
            'admin-id'
          )
        ).rejects.toThrow('use the cancellation workflow');

        expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
        expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
        expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
        expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
      }
    );

    it('should preserve a cancelled registration when no resulting status is requested', async () => {
      const cancelledPayment = {
        ...basePayment,
        registration: {
          ...basePayment.registration,
          status: RegistrationStatus.CANCELLED,
        },
      };
      mockPrismaService.payment.findUnique
        .mockReset()
        .mockResolvedValueOnce(cancelledPayment)
        .mockResolvedValueOnce(
          buildUpdatedPayment(
            PaymentStatus.PARTIALLY_REFUNDED,
            [publicCreatedRefund],
            RegistrationStatus.CANCELLED
          )
        );

      const actualResult = await service.createManualRefund(
        paymentId,
        inputRequest,
        'admin-id'
      );

      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(actualResult.payment.registration?.status).toBe(RegistrationStatus.CANCELLED);
    });

    it('should return an identical replay without duplicate writes', async () => {
      const replayPayment = buildUpdatedPayment(PaymentStatus.PARTIALLY_REFUNDED);
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(createdRefund);
      mockPrismaService.payment.findUnique.mockReset().mockResolvedValue(replayPayment);

      const actualResult = await service.createManualRefund(paymentId, inputRequest, 'admin-id');

      expect(actualResult.refund).toEqual(publicCreatedRefund);
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should replay a full-refund request after another reservation fails', async () => {
      const fullRefund = {
        ...createdRefund,
        amountCents: 8000,
      };
      const changedLedgerPayment = {
        ...basePayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunds: [
          {
            ...publicCreatedRefund,
            amountCents: 8000,
          },
          {
            ...publicCreatedRefund,
            id: 'failed-reservation',
            amountCents: 2000,
            status: PaymentRefundStatus.FAILED,
          },
        ],
      };
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(fullRefund);
      mockPrismaService.payment.findUnique.mockReset().mockResolvedValue(changedLedgerPayment);
      mockPrismaService.adminAudit.findFirst.mockResolvedValue({
        newValues: { requestedFullRefund: true },
      });

      const actualResult = await service.createManualRefund(
        paymentId,
        {
          fullRefund: true,
          executionMode: RefundExecutionMode.MANUAL,
          reason: inputRequest.reason,
          externalReference: inputRequest.externalReference,
          idempotencyKey,
        },
        'admin-id'
      );

      expect(actualResult.refund.amountCents).toBe(8000);
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.adminAudit.create).not.toHaveBeenCalled();
    });

    it('should resolve a full-refund P2002 winner after another reservation fails', async () => {
      const fullRefund = {
        ...createdRefund,
        amountCents: 8000,
      };
      const changedLedgerPayment = {
        ...basePayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunds: [
          {
            ...publicCreatedRefund,
            amountCents: 8000,
          },
          {
            ...publicCreatedRefund,
            id: 'failed-reservation',
            amountCents: 2000,
            status: PaymentRefundStatus.FAILED,
          },
        ],
      };
      mockPrismaService.$transaction.mockRejectedValue({ code: 'P2002' });
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(fullRefund);
      mockPrismaService.payment.findUnique.mockReset().mockResolvedValue(changedLedgerPayment);
      mockPrismaService.adminAudit.findFirst.mockResolvedValue({
        newValues: { requestedFullRefund: true },
      });

      const actualResult = await service.createManualRefund(
        paymentId,
        {
          fullRefund: true,
          executionMode: RefundExecutionMode.MANUAL,
          reason: inputRequest.reason,
          externalReference: inputRequest.externalReference,
          idempotencyKey,
        },
        'admin-id'
      );

      expect(actualResult.refund.amountCents).toBe(8000);
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
    });

    it('should reject idempotency key reuse with different amount or full-refund semantics', async () => {
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(createdRefund);
      mockPrismaService.payment.findUnique
        .mockReset()
        .mockResolvedValue(buildUpdatedPayment(PaymentStatus.PARTIALLY_REFUNDED));

      await expect(
        service.createManualRefund(paymentId, { ...inputRequest, amountCents: 2000 }, 'admin-id')
      ).rejects.toThrow(ConflictException);

      mockPrismaService.adminAudit.findFirst.mockResolvedValue({
        newValues: { requestedFullRefund: false },
      });
      await expect(
        service.createManualRefund(
          paymentId,
          {
            fullRefund: true,
            executionMode: RefundExecutionMode.MANUAL,
            idempotencyKey,
          },
          'admin-id'
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should resolve an identical concurrent unique-key race', async () => {
      mockPrismaService.$transaction.mockRejectedValue({ code: 'P2002' });
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(createdRefund);
      mockPrismaService.payment.findUnique
        .mockReset()
        .mockResolvedValue(buildUpdatedPayment(PaymentStatus.PARTIALLY_REFUNDED));

      const actualResult = await service.createManualRefund(paymentId, inputRequest, 'admin-id');

      expect(actualResult.refund.id).toBe('refund-id');
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
    });

    it('should translate a serialization conflict to refresh-and-retry conflict', async () => {
      mockPrismaService.$transaction.mockRejectedValue({ code: 'P2034' });

      await expect(service.createManualRefund(paymentId, inputRequest, 'admin-id')).rejects.toThrow(
        'Refund balance changed concurrently; refresh the payment and retry'
      );
      expect(mockPrismaService.paymentRefund.findUnique).not.toHaveBeenCalled();
    });

    it('should propagate audit failure so the serializable transaction rolls back', async () => {
      mockPrismaService.adminAudit.create.mockRejectedValue(new Error('Audit write failed'));

      await expect(service.createManualRefund(paymentId, inputRequest, 'admin-id')).rejects.toThrow(
        'Audit write failed'
      );
      expect(mockPrismaService.paymentRefund.create).toHaveBeenCalled();
      expect(mockPrismaService.payment.update).toHaveBeenCalled();
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledTimes(1);
    });

    it.each([PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.REFUNDED])(
      'should reject payment status %s',
      async inputStatus => {
        mockPrismaService.payment.findUnique
          .mockReset()
          .mockResolvedValue({ ...basePayment, status: inputStatus });

        await expect(
          service.createManualRefund(paymentId, inputRequest, 'admin-id')
        ).rejects.toThrow(`Cannot refund payment with status ${inputStatus}`);
        expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      }
    );
  });

  describe('Stripe refund command', () => {
    const paymentId = '5f8d0d55-e0a3-4cf0-a620-2412acd4361c';
    const refundId = '6a9e1e88-e8c0-43f1-9fe4-a2cad9703120';
    const idempotencyKey = '43ea4b84-1f0d-413d-bc1c-9c91b435d66d';
    const stripeRequest = {
      amountCents: 2500,
      executionMode: RefundExecutionMode.STRIPE,
      reason: 'duplicate charge',
      idempotencyKey,
    };
    const pendingRefund = {
      id: refundId,
      paymentId,
      amountCents: 2500,
      currency: 'USD',
      executionMode: RefundExecutionMode.STRIPE,
      status: PaymentRefundStatus.PENDING,
      reason: 'duplicate charge',
      externalReference: null,
      providerRefundId: null,
      idempotencyKey,
      processedByUserId: 'admin-id',
      resultingRegistrationStatus: null,
      failureMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const publicPendingRefund = {
      id: refundId,
      amountCents: 2500,
      currency: 'USD',
      executionMode: RefundExecutionMode.STRIPE,
      status: PaymentRefundStatus.PENDING,
      reason: 'duplicate charge',
      externalReference: null,
      resultingRegistrationStatus: null,
      createdAt: pendingRefund.createdAt,
      updatedAt: pendingRefund.updatedAt,
    };
    const stripePayment = {
      id: paymentId,
      amount: 100,
      currency: 'USD',
      status: PaymentStatus.COMPLETED,
      provider: PaymentProvider.STRIPE,
      providerRefId: 'pi_original',
      externalMethod: null,
      externalReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-id',
      registrationId: 'registration-id',
      user: {
        id: 'user-id',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      },
      registration: {
        id: 'registration-id',
        year: 2026,
        status: RegistrationStatus.CONFIRMED,
      },
      refunds: [],
    };

    function buildStripePayment(
      status: PaymentStatus,
      refundStatus: PaymentRefundStatus
    ) {
      return {
        ...stripePayment,
        status,
        refunds: [{ ...publicPendingRefund, status: refundStatus }],
      };
    }

    beforeEach(() => {
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: typeof mockPrismaService) => Promise<unknown>) =>
          callback(mockPrismaService)
      );
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(null);
      mockPrismaService.paymentRefund.create.mockResolvedValue(pendingRefund);
      mockPrismaService.paymentRefund.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.payment.findUnique.mockResolvedValue(stripePayment);
      mockPrismaService.payment.update.mockResolvedValue(stripePayment);
      mockPrismaService.payment.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.registration.findUnique.mockResolvedValue({
        status: RegistrationStatus.CONFIRMED,
      });
      mockPrismaService.registration.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.adminAudit.create.mockResolvedValue({ id: 'audit-id' });
      mockPrismaService.adminAudit.findFirst.mockResolvedValue({
        newValues: { requestedFullRefund: false },
      });
      mockStripeService.createAdminRefund.mockResolvedValue({
        outcome: 'PENDING_UNKNOWN',
      });
      mockStripeService.findAdminRefund.mockResolvedValue({
        outcome: 'PENDING_UNKNOWN',
      });
    });

    it('should reserve and audit before submitting outside the serializable transaction', async () => {
      let transactionCompleted = false;
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: typeof mockPrismaService) => Promise<unknown>) => {
          const result = await callback(mockPrismaService);
          transactionCompleted = true;
          return result;
        }
      );
      mockStripeService.createAdminRefund.mockImplementation(async () => {
        expect(transactionCompleted).toBe(true);
        return { outcome: 'PENDING_UNKNOWN' };
      });

      const actualResult = await service.createRefund(paymentId, stripeRequest, 'admin-id');

      expect(mockPrismaService.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      expect(mockPrismaService.paymentRefund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentId,
          amountCents: 2500,
          currency: 'USD',
          executionMode: RefundExecutionMode.STRIPE,
          status: PaymentRefundStatus.PENDING,
          idempotencyKey,
        }),
        select: expect.objectContaining({
          providerRefundId: true,
          failureMessage: true,
        }),
      });
      expect(mockPrismaService.adminAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          newValues: expect.objectContaining({
            phase: 'ATTEMPT',
            outcome: PaymentRefundStatus.PENDING,
            refundId,
          }),
        }),
      });
      expect(mockStripeService.createAdminRefund).toHaveBeenCalledWith({
        providerRefId: 'pi_original',
        amountCents: 2500,
        reason: 'duplicate charge',
        idempotencyKey,
        localRefundId: refundId,
      });
      expect(actualResult).toEqual(
        expect.objectContaining({
          outcome: 'PENDING_UNKNOWN',
          pendingRefundCents: 2500,
          availableRefundCents: 7500,
        })
      );
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
    });

    it('should finalize the same row and apply registration status only after Stripe succeeds', async () => {
      const requestedStatus = RegistrationStatus.WAITLISTED;
      const request = {
        ...stripeRequest,
        resultingRegistrationStatus: requestedStatus,
      };
      const pendingWithStatus = {
        ...pendingRefund,
        resultingRegistrationStatus: requestedStatus,
      };
      const succeededRefund = {
        ...pendingWithStatus,
        status: PaymentRefundStatus.SUCCEEDED,
        providerRefundId: 're_provider',
      };
      mockPrismaService.paymentRefund.create.mockResolvedValue(pendingWithStatus);
      mockPrismaService.paymentRefund.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(pendingWithStatus)
        .mockResolvedValueOnce(succeededRefund);
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(stripePayment)
        .mockResolvedValueOnce({
          ...stripePayment,
          refunds: [{ ...publicPendingRefund, resultingRegistrationStatus: requestedStatus }],
        })
        .mockResolvedValueOnce({
          ...buildStripePayment(
            PaymentStatus.PARTIALLY_REFUNDED,
            PaymentRefundStatus.SUCCEEDED
          ),
          registration: { ...stripePayment.registration, status: requestedStatus },
        });
      mockStripeService.createAdminRefund.mockResolvedValue({
        outcome: 'SUCCEEDED',
        providerRefundId: 're_provider',
      });

      const actualResult = await service.createRefund(paymentId, request, 'admin-id');

      expect(mockPrismaService.paymentRefund.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: refundId,
          status: PaymentRefundStatus.PENDING,
        }),
        data: {
          status: PaymentRefundStatus.SUCCEEDED,
          providerRefundId: 're_provider',
          failureMessage: null,
        },
      });
      expect(mockPrismaService.payment.updateMany).toHaveBeenCalledWith({
        where: { id: paymentId, status: PaymentStatus.COMPLETED },
        data: { status: PaymentStatus.PARTIALLY_REFUNDED },
      });
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: 'registration-id' },
        select: { status: true },
      });
      expect(mockPrismaService.registration.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'registration-id',
          status: RegistrationStatus.CONFIRMED,
        },
        data: { status: requestedStatus },
      });
      expect(mockPrismaService.adminAudit.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          newValues: expect.objectContaining({
            phase: 'RESULT',
            outcome: PaymentRefundStatus.SUCCEEDED,
            providerRefundId: 're_provider',
          }),
        }),
      });
      expect(actualResult.outcome).toBe('SUCCEEDED');
      expect(actualResult.refund).not.toHaveProperty('providerRefundId');
    });

    it.each([PaymentStatus.FAILED, PaymentStatus.REFUNDED])(
      'should leave a confirmed processor refund recoverable when payment became %s',
      async protectedStatus => {
        mockPrismaService.paymentRefund.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(pendingRefund);
        mockPrismaService.payment.findUnique
          .mockResolvedValueOnce(stripePayment)
          .mockResolvedValueOnce({
            ...stripePayment,
            status: protectedStatus,
            refunds: [publicPendingRefund],
          });
        mockStripeService.createAdminRefund.mockResolvedValue({
          outcome: 'SUCCEEDED',
          providerRefundId: 're_provider',
        });

        const actualResult = await service.createRefund(paymentId, stripeRequest, 'admin-id');

        expect(actualResult.outcome).toBe('PENDING_UNKNOWN');
        expect(mockStripeService.createAdminRefund).toHaveBeenCalledTimes(1);
        expect(mockPrismaService.paymentRefund.updateMany).not.toHaveBeenCalled();
        expect(mockPrismaService.payment.updateMany).not.toHaveBeenCalled();
        expect(mockPrismaService.adminAudit.create).toHaveBeenCalledTimes(1);
      }
    );

    it('should roll back local finalization when the eligible payment status guard loses a race', async () => {
      mockPrismaService.paymentRefund.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(pendingRefund);
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(stripePayment)
        .mockResolvedValueOnce({
          ...stripePayment,
          refunds: [publicPendingRefund],
        });
      mockPrismaService.payment.updateMany.mockResolvedValue({ count: 0 });
      mockStripeService.createAdminRefund.mockResolvedValue({
        outcome: 'SUCCEEDED',
        providerRefundId: 're_provider',
      });

      const actualResult = await service.createRefund(paymentId, stripeRequest, 'admin-id');

      expect(actualResult.outcome).toBe('PENDING_UNKNOWN');
      expect(mockPrismaService.payment.updateMany).toHaveBeenCalledWith({
        where: { id: paymentId, status: PaymentStatus.COMPLETED },
        data: { status: PaymentStatus.PARTIALLY_REFUNDED },
      });
      expect(mockStripeService.createAdminRefund).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.adminAudit.create).toHaveBeenCalledTimes(1);
    });

    it.each([
      RegistrationStatus.CANCELLED,
      RegistrationStatus.APPLICATION_SUBMITTED,
    ])(
      'should preserve concurrent protected registration status %s while finalizing the refund',
      async protectedStatus => {
        const requestedStatus = RegistrationStatus.WAITLISTED;
        const pendingWithStatus = {
          ...pendingRefund,
          resultingRegistrationStatus: requestedStatus,
        };
        const succeededRefund = {
          ...pendingWithStatus,
          status: PaymentRefundStatus.SUCCEEDED,
          providerRefundId: 're_provider',
        };
        mockPrismaService.paymentRefund.create.mockResolvedValue(pendingWithStatus);
        mockPrismaService.paymentRefund.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(pendingWithStatus)
          .mockResolvedValueOnce(succeededRefund);
        mockPrismaService.payment.findUnique
          .mockResolvedValueOnce(stripePayment)
          .mockResolvedValueOnce({
            ...stripePayment,
            refunds: [{ ...publicPendingRefund, resultingRegistrationStatus: requestedStatus }],
          })
          .mockResolvedValueOnce({
            ...buildStripePayment(
              PaymentStatus.PARTIALLY_REFUNDED,
              PaymentRefundStatus.SUCCEEDED
            ),
            registration: { ...stripePayment.registration, status: protectedStatus },
          });
        mockStripeService.createAdminRefund.mockResolvedValue({
          outcome: 'SUCCEEDED',
          providerRefundId: 're_provider',
        });
        mockPrismaService.registration.findUnique.mockResolvedValue({
          status: protectedStatus,
        });

        const actualResult = await service.createRefund(
          paymentId,
          {
            ...stripeRequest,
            resultingRegistrationStatus: requestedStatus,
          },
          'admin-id'
        );

        expect(actualResult.outcome).toBe('SUCCEEDED');
        expect(mockPrismaService.registration.updateMany).not.toHaveBeenCalled();
        expect(mockPrismaService.adminAudit.create).toHaveBeenLastCalledWith({
          data: expect.objectContaining({
            newValues: expect.objectContaining({
              outcome: PaymentRefundStatus.SUCCEEDED,
              resultingRegistrationStatus: requestedStatus,
              registrationStatusBefore: protectedStatus,
              registrationStatusAfter: protectedStatus,
              registrationStatusApplied: false,
              registrationStatusSkipReason: 'CONCURRENT_PROTECTED_STATE',
            }),
          }),
        });
      }
    );

    it('should keep successful Stripe finalization recoverable after an ordinary registration race', async () => {
      const requestedStatus = RegistrationStatus.WAITLISTED;
      const pendingWithStatus = {
        ...pendingRefund,
        resultingRegistrationStatus: requestedStatus,
      };
      mockPrismaService.paymentRefund.create.mockResolvedValue(pendingWithStatus);
      mockPrismaService.paymentRefund.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(pendingWithStatus);
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(stripePayment)
        .mockResolvedValueOnce({
          ...stripePayment,
          refunds: [{ ...publicPendingRefund, resultingRegistrationStatus: requestedStatus }],
        });
      mockStripeService.createAdminRefund.mockResolvedValue({
        outcome: 'SUCCEEDED',
        providerRefundId: 're_provider',
      });
      mockPrismaService.registration.updateMany.mockResolvedValue({ count: 0 });

      const actualResult = await service.createRefund(
        paymentId,
        {
          ...stripeRequest,
          resultingRegistrationStatus: requestedStatus,
        },
        'admin-id'
      );

      expect(actualResult.outcome).toBe('PENDING_UNKNOWN');
      expect(mockPrismaService.registration.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'registration-id',
          status: RegistrationStatus.CONFIRMED,
        },
        data: { status: requestedStatus },
      });
      expect(mockStripeService.createAdminRefund).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.adminAudit.create).toHaveBeenCalledTimes(1);
    });

    it('should fail a definite rejection, release the reservation, and preserve payment state', async () => {
      const failedRefund = {
        ...pendingRefund,
        status: PaymentRefundStatus.FAILED,
        failureMessage: 'Stripe rejected the refund request',
      };
      mockPrismaService.paymentRefund.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(pendingRefund)
        .mockResolvedValueOnce(failedRefund);
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(stripePayment)
        .mockResolvedValueOnce(buildStripePayment(PaymentStatus.COMPLETED, PaymentRefundStatus.PENDING))
        .mockResolvedValueOnce(buildStripePayment(PaymentStatus.COMPLETED, PaymentRefundStatus.FAILED));
      mockStripeService.createAdminRefund.mockResolvedValue({
        outcome: 'FAILED',
        failureMessage: 'Stripe rejected the refund request',
      });

      const actualResult = await service.createRefund(paymentId, stripeRequest, 'admin-id');

      expect(mockPrismaService.paymentRefund.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: refundId }),
        data: {
          status: PaymentRefundStatus.FAILED,
          failureMessage: 'Stripe rejected the refund request',
        },
      });
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      expect(actualResult).toEqual(
        expect.objectContaining({
          outcome: 'FAILED',
          pendingRefundCents: 0,
          availableRefundCents: 10000,
        })
      );
      expect(actualResult.refund).not.toHaveProperty('failureMessage');
    });

    it('should return an idempotent pending replay without another Stripe submission', async () => {
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(pendingRefund);
      mockPrismaService.payment.findUnique.mockResolvedValue(
        buildStripePayment(PaymentStatus.COMPLETED, PaymentRefundStatus.PENDING)
      );

      const actualResult = await service.createRefund(paymentId, stripeRequest, 'admin-id');

      expect(actualResult.outcome).toBe('PENDING_UNKNOWN');
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockStripeService.createAdminRefund).not.toHaveBeenCalled();
    });

    it('should return a terminal full-refund replay without depending on the current balance', async () => {
      const failedFullRefund = {
        ...pendingRefund,
        amountCents: 10000,
        status: PaymentRefundStatus.FAILED,
      };
      const otherSuccessfulRefund = {
        ...publicPendingRefund,
        id: 'other-refund',
        amountCents: 1000,
        status: PaymentRefundStatus.SUCCEEDED,
      };
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(failedFullRefund);
      mockPrismaService.payment.findUnique.mockResolvedValue({
        ...stripePayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunds: [
          {
            ...publicPendingRefund,
            amountCents: 10000,
            status: PaymentRefundStatus.FAILED,
          },
          otherSuccessfulRefund,
        ],
      });
      mockPrismaService.adminAudit.findFirst.mockResolvedValue({
        newValues: { requestedFullRefund: true },
      });

      const actualResult = await service.createRefund(
        paymentId,
        {
          fullRefund: true,
          executionMode: RefundExecutionMode.STRIPE,
          reason: 'duplicate charge',
          idempotencyKey,
        },
        'admin-id'
      );

      expect(actualResult.outcome).toBe('FAILED');
      expect(mockPrismaService.adminAudit.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          newValues: {
            path: ['phase'],
            equals: 'ATTEMPT',
          },
        }),
        select: { newValues: true },
      });
      expect(mockStripeService.createAdminRefund).not.toHaveBeenCalled();
    });

    it.each([
      [{ ...stripePayment, provider: PaymentProvider.PAYPAL }, 'original STRIPE payment'],
      [{ ...stripePayment, providerRefId: ' ' }, 'usable provider reference'],
      [{ ...stripePayment, currency: 'usd' }, 'stored payment currency'],
      [{ ...stripePayment, amount: 10.001 }, 'sub-cent precision'],
    ])('should reject ineligible Stripe payment data', async (inputPayment, expectedMessage) => {
      mockPrismaService.payment.findUnique.mockResolvedValue(inputPayment);

      await expect(
        service.createRefund(paymentId, stripeRequest, 'admin-id')
      ).rejects.toThrow(expectedMessage);
      expect(mockPrismaService.paymentRefund.create).not.toHaveBeenCalled();
      expect(mockStripeService.createAdminRefund).not.toHaveBeenCalled();
    });

    it('should inspect metadata first and finalize a matching pending retry', async () => {
      const paymentWithPending = buildStripePayment(
        PaymentStatus.COMPLETED,
        PaymentRefundStatus.PENDING
      );
      const succeededRefund = {
        ...pendingRefund,
        status: PaymentRefundStatus.SUCCEEDED,
        providerRefundId: 're_found',
      };
      mockPrismaService.paymentRefund.findUnique
        .mockResolvedValueOnce(pendingRefund)
        .mockResolvedValueOnce(pendingRefund)
        .mockResolvedValueOnce(succeededRefund);
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(paymentWithPending)
        .mockResolvedValueOnce(paymentWithPending)
        .mockResolvedValueOnce(
          buildStripePayment(
            PaymentStatus.PARTIALLY_REFUNDED,
            PaymentRefundStatus.SUCCEEDED
          )
        );
      mockStripeService.findAdminRefund.mockResolvedValue({
        outcome: 'FOUND',
        providerRefundId: 're_found',
      });

      const actualResult = await service.retryStripeRefund(
        paymentId,
        refundId,
        'retry-admin'
      );

      expect(mockStripeService.findAdminRefund).toHaveBeenCalledWith('pi_original', refundId);
      expect(mockStripeService.createAdminRefund).not.toHaveBeenCalled();
      expect(actualResult.outcome).toBe('SUCCEEDED');
    });

    it('should not resubmit a found Stripe refund when local payment finalization conflicts', async () => {
      const paymentWithPending = buildStripePayment(
        PaymentStatus.COMPLETED,
        PaymentRefundStatus.PENDING
      );
      mockPrismaService.paymentRefund.findUnique
        .mockResolvedValueOnce(pendingRefund)
        .mockResolvedValueOnce(pendingRefund);
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(paymentWithPending)
        .mockResolvedValueOnce(paymentWithPending);
      mockPrismaService.payment.updateMany.mockResolvedValue({ count: 0 });
      mockStripeService.findAdminRefund.mockResolvedValue({
        outcome: 'FOUND',
        providerRefundId: 're_found',
      });

      const actualResult = await service.retryStripeRefund(
        paymentId,
        refundId,
        'retry-admin'
      );

      expect(actualResult.outcome).toBe('PENDING_UNKNOWN');
      expect(mockStripeService.findAdminRefund).toHaveBeenCalledTimes(1);
      expect(mockStripeService.createAdminRefund).not.toHaveBeenCalled();
    });

    it('should resubmit the exact stored request with the same key only after inspection misses', async () => {
      const paymentWithPending = buildStripePayment(
        PaymentStatus.COMPLETED,
        PaymentRefundStatus.PENDING
      );
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(pendingRefund);
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentWithPending);
      mockStripeService.findAdminRefund.mockResolvedValue({ outcome: 'NOT_FOUND' });
      mockStripeService.createAdminRefund.mockResolvedValue({
        outcome: 'PENDING_UNKNOWN',
      });

      const actualResult = await service.retryStripeRefund(
        paymentId,
        refundId,
        'retry-admin'
      );

      expect(mockStripeService.createAdminRefund).toHaveBeenCalledWith({
        providerRefId: 'pi_original',
        amountCents: 2500,
        reason: 'duplicate charge',
        idempotencyKey,
        localRefundId: refundId,
      });
      expect(actualResult.outcome).toBe('PENDING_UNKNOWN');
    });

    it('should not resubmit when Stripe inspection cannot complete', async () => {
      const paymentWithPending = buildStripePayment(
        PaymentStatus.COMPLETED,
        PaymentRefundStatus.PENDING
      );
      mockPrismaService.paymentRefund.findUnique.mockResolvedValue(pendingRefund);
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentWithPending);
      mockStripeService.findAdminRefund.mockResolvedValue({
        outcome: 'PENDING_UNKNOWN',
      });

      const actualResult = await service.retryStripeRefund(
        paymentId,
        refundId,
        'retry-admin'
      );

      expect(actualResult.outcome).toBe('PENDING_UNKNOWN');
      expect(mockStripeService.createAdminRefund).not.toHaveBeenCalled();
    });

    it('should fail the reservation when inspection finds a terminal Stripe failure', async () => {
      const paymentWithPending = buildStripePayment(
        PaymentStatus.COMPLETED,
        PaymentRefundStatus.PENDING
      );
      const failedRefund = {
        ...pendingRefund,
        status: PaymentRefundStatus.FAILED,
        failureMessage: 'Stripe rejected the refund request with status failed',
      };
      mockPrismaService.paymentRefund.findUnique
        .mockResolvedValueOnce(pendingRefund)
        .mockResolvedValueOnce(pendingRefund)
        .mockResolvedValueOnce(failedRefund);
      mockPrismaService.payment.findUnique
        .mockResolvedValueOnce(paymentWithPending)
        .mockResolvedValueOnce(paymentWithPending)
        .mockResolvedValueOnce(
          buildStripePayment(PaymentStatus.COMPLETED, PaymentRefundStatus.FAILED)
        );
      mockStripeService.findAdminRefund.mockResolvedValue({
        outcome: 'FAILED',
        failureMessage: 'Stripe rejected the refund request with status failed',
      });

      const actualResult = await service.retryStripeRefund(
        paymentId,
        refundId,
        'retry-admin'
      );

      expect(actualResult.outcome).toBe('FAILED');
      expect(mockStripeService.createAdminRefund).not.toHaveBeenCalled();
    });

    it.each([PaymentRefundStatus.SUCCEEDED, PaymentRefundStatus.FAILED])(
      'should return terminal retry status %s unchanged',
      async terminalStatus => {
        const terminalRefund = { ...pendingRefund, status: terminalStatus };
        mockPrismaService.paymentRefund.findUnique.mockResolvedValue(terminalRefund);
        mockPrismaService.payment.findUnique.mockResolvedValue(
          buildStripePayment(PaymentStatus.PARTIALLY_REFUNDED, terminalStatus)
        );

        const actualResult = await service.retryStripeRefund(
          paymentId,
          refundId,
          'retry-admin'
        );

        expect(actualResult.outcome).toBe(terminalStatus);
        expect(mockStripeService.findAdminRefund).not.toHaveBeenCalled();
        expect(mockStripeService.createAdminRefund).not.toHaveBeenCalled();
      }
    );
  });
});
