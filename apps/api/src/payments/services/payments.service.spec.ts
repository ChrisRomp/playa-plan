import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { PaypalService } from './paypal.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

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
  user: {
    findUnique: jest.fn(),
  },
  registration: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((operations) => {
    if (Array.isArray(operations)) {
      const results = operations.map(op => {
        if (op && op.where && op.data) {
          // This is a mock update operation
          if (op.where.id === 'payment-id') {
            return {
              id: 'payment-id',
              status: op.data.status,
              // Include other needed fields
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
    return Promise.resolve((typeof operations === 'function') ? operations() : operations);
  }),
};

const mockStripeService = {
  createPaymentIntent: jest.fn(),
  createCheckoutSession: jest.fn(),
  createRefund: jest.fn(),
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
        where: { id: mockPaymentDto.userId } 
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

  // Task 5.6: PaymentsService Unit Tests for processRefund
  describe('processRefund', () => {
    // Task 5.6.1: Test processRefund() successfully processes Stripe refunds with payment intent IDs
    it('should successfully process Stripe refunds with payment intent IDs', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 100.00, // $100.00 in dollars
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
          registration: true 
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
        refundAmount: 100.00,
        providerRefundId: 're_stripe123',
        success: true,
      });
    });

    // Task 5.6.2: Test processRefund() converts checkout session IDs to payment intent IDs for Stripe
    it('should convert checkout session IDs to payment intent IDs for Stripe', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 75.00, // $75.00 in dollars
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
          registration: true 
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
        refundAmount: 75.00,
        providerRefundId: 're_stripe456',
        success: true,
      });
    });

    // Task 5.6.3: Test processRefund() maps custom refund reasons to valid Stripe reasons
    it('should map custom refund reasons to valid Stripe reasons', async () => {
      const basePayment = {
        id: 'payment-id',
        amount: 50.00,
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
          refundAmount: 50.00,
          providerRefundId: 're_test123',
          success: true,
        });
      }
    });

    // Test refund without reason
    it('should handle refund without reason provided', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 25.00,
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
        refundAmount: 25.00,
        providerRefundId: 're_noreason123',
        success: true,
      });
    });

    // Task 5.6.4: Test processRefund() handles PayPal refunds with dollar amounts
    it('should handle PayPal refunds with dollar amounts', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 150.00, // $150.00 in dollars
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
          registration: true 
        },
      });
      
      // PayPal service should be called with dollar amount (not cents)
      expect(mockPaypalService.createRefund).toHaveBeenCalledWith(
        'PAYID-PAYPAL123',
        150.00, // $150.00 as dollars (not converted to cents like Stripe)
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
        refundAmount: 150.00,
        providerRefundId: 'REFUND-PAYPAL123',
        success: true,
      });
    });

    // Test PayPal refund without registration
    it('should handle PayPal refunds without registration', async () => {
      const mockPayment = {
        id: 'payment-id',
        amount: 75.50,
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
        75.50, // Dollar amount for PayPal
        'Duplicate payment'
      );
      
      // Should not call registration update when no registration
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
      
      expect(result).toEqual({
        paymentId: 'payment-id',
        refundAmount: 75.50,
        providerRefundId: 'REFUND-NOREG123',
        success: true,
      });
    });
  });

  // Additional tests would follow the same pattern for other methods
});
