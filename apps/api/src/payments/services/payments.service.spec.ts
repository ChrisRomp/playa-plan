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

  // Additional tests would follow the same pattern for other methods
}); 