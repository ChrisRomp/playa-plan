import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { PaypalService } from './paypal.service';
import { PrismaService } from '../../common/prisma/prisma.service';
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
  $transaction: jest.fn((callback) => callback()),
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

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaService: PrismaService;
  let stripeService: StripeService;
  let paypalService: PaypalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: PaypalService, useValue: mockPaypalService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prismaService = module.get<PrismaService>(PrismaService);
    stripeService = module.get<StripeService>(StripeService);
    paypalService = module.get<PaypalService>(PaypalService);

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

    it('should verify successful payment and update statuses', async () => {
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
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });
      mockPrismaService.registration.update.mockResolvedValue({
        ...mockRegistration,
        status: 'CONFIRMED',
      });

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
      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: mockRegistration.id },
        data: { status: 'CONFIRMED' },
      });
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

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(paymentWithoutRegistration);
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentWithoutRegistration);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

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
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
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
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
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

      // Setup mocks
      mockPrismaService.payment.findFirst.mockResolvedValue(paymentWithRegistration);
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentWithRegistration);
      mockStripeService.getCheckoutSession.mockResolvedValue(mockStripeSession);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.FAILED,
      });

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
          notes: 'Checkout session expired',
        },
      });
      // Should not update registration for failed payment
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
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
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.update).not.toHaveBeenCalled();
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

    it('should handle database update errors gracefully', async () => {
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
      mockPrismaService.payment.update.mockRejectedValue(new Error('Database error'));

      // Execute & Assert
      await expect(service.verifyStripeSession(sessionId)).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.payment.findFirst).toHaveBeenCalledWith({
        where: { providerRefId: sessionId },
        include: { registration: true },
      });
      expect(mockStripeService.getCheckoutSession).toHaveBeenCalledWith(sessionId);
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: mockPayment.id },
        data: { status: PaymentStatus.COMPLETED },
      });
    });
  });

  // Additional tests would follow the same pattern for other methods
}); 