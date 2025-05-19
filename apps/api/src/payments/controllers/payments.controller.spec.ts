import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService, StripeService, PaypalService } from '../services';
import { PaymentStatus, PaymentProvider } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';

// Mock implementations
const mockPaymentsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  recordManualPayment: jest.fn(),
  initiateStripePayment: jest.fn(),
  initiatePaypalPayment: jest.fn(),
  processRefund: jest.fn(),
  linkToRegistration: jest.fn(),
  handleStripeWebhook: jest.fn(),
  handlePaypalWebhook: jest.fn(),
};

const mockStripeService = {
  createPaymentIntent: jest.fn(),
  createCheckoutSession: jest.fn(),
};

const mockPaypalService = {
  createOrder: jest.fn(),
  capturePayment: jest.fn(),
};

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: PaypalService, useValue: mockPaypalService },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    paymentsService = module.get<PaymentsService>(PaymentsService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPayment', () => {
    it('should create a payment record', async () => {
      // Mock data
      const mockPaymentDto = {
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.STRIPE,
        userId: 'user-id',
        providerRefId: 'provider-ref-id',
      };
      const mockPayment = { 
        id: 'payment-id', 
        ...mockPaymentDto,
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      mockPaymentsService.create.mockResolvedValue(mockPayment);

      // Execute
      const result = await controller.createPayment(mockPaymentDto);

      // Assert
      expect(mockPaymentsService.create).toHaveBeenCalledWith(mockPaymentDto);
      expect(result).toEqual(mockPayment);
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
      const mockResponse = { payments: mockPayments, total: mockTotal };

      // Setup mocks
      mockPaymentsService.findAll.mockResolvedValue(mockResponse);

      // Execute
      const result = await controller.findAll('0', '10');

      // Assert
      expect(mockPaymentsService.findAll).toHaveBeenCalledWith(0, 10, undefined, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should apply filters when provided', async () => {
      // Mock data
      const mockPayments = [{ id: 'payment-1', amount: 100 }];
      const mockTotal = 1;
      const mockResponse = { payments: mockPayments, total: mockTotal };
      const skip = '0';
      const take = '10';
      const userId = 'user-id';
      const status = PaymentStatus.COMPLETED;

      // Setup mocks
      mockPaymentsService.findAll.mockResolvedValue(mockResponse);

      // Execute
      const result = await controller.findAll(skip, take, userId, status);

      // Assert
      expect(mockPaymentsService.findAll).toHaveBeenCalledWith(0, 10, userId, status);
      expect(result).toEqual(mockResponse);
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
      mockPaymentsService.findOne.mockResolvedValue(mockPayment);

      // Execute
      const result = await controller.findOne(paymentId);

      // Assert
      expect(mockPaymentsService.findOne).toHaveBeenCalledWith(paymentId);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('update', () => {
    it('should update a payment', async () => {
      // Mock data
      const paymentId = 'payment-id';
      const updateDto = { status: PaymentStatus.COMPLETED };
      const mockPayment = { 
        id: paymentId, 
        amount: 100,
        status: PaymentStatus.COMPLETED,
      };

      // Setup mocks
      mockPaymentsService.update.mockResolvedValue(mockPayment);

      // Execute
      const result = await controller.update(paymentId, updateDto);

      // Assert
      expect(mockPaymentsService.update).toHaveBeenCalledWith(paymentId, updateDto);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('recordManualPayment', () => {
    it('should record a manual payment', async () => {
      // Mock data
      const mockManualPaymentDto = {
        amount: 100,
        currency: 'USD',
        userId: 'user-id',
        reference: 'Cash payment',
        status: PaymentStatus.COMPLETED,
      };
      const mockPayment = { 
        id: 'payment-id', 
        amount: 100,
        currency: 'USD',
        userId: 'user-id',
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'manual:Cash payment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      mockPaymentsService.recordManualPayment.mockResolvedValue(mockPayment);

      // Execute
      const result = await controller.recordManualPayment(mockManualPaymentDto);

      // Assert
      expect(mockPaymentsService.recordManualPayment).toHaveBeenCalledWith(mockManualPaymentDto);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('initiateStripePayment', () => {
    it('should initiate a Stripe payment', async () => {
      // Mock data
      const mockStripePaymentDto = {
        amount: 10000, // in cents
        currency: 'USD',
        userId: 'user-id',
        description: 'Test payment',
        successUrl: 'https://mycamp.playaplan.app/success',
        cancelUrl: 'https://mycamp.playaplan.app/cancel',
      };
      const mockResponse = { 
        paymentId: 'payment-id', 
        url: 'https://checkout.stripe.com/session-id',
      };

      // Setup mocks
      mockPaymentsService.initiateStripePayment.mockResolvedValue(mockResponse);

      // Execute
      const result = await controller.initiateStripePayment(mockStripePaymentDto);

      // Assert
      expect(mockPaymentsService.initiateStripePayment).toHaveBeenCalledWith(mockStripePaymentDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('initiatePaypalPayment', () => {
    it('should initiate a PayPal payment', async () => {
      // Mock data
      const mockPaypalPaymentDto = {
        amount: 100,
        currency: 'USD',
        userId: 'user-id',
        itemDescription: 'Test payment',
        successUrl: 'https://mycamp.playaplan.app/success',
        cancelUrl: 'https://mycamp.playaplan.app/cancel',
      };
      const mockResponse = { 
        paymentId: 'payment-id', 
        orderId: 'paypal-order-id',
        approvalUrl: 'https://www.paypal.com/checkoutnow/order-id',
      };

      // Setup mocks
      mockPaymentsService.initiatePaypalPayment.mockResolvedValue(mockResponse);

      // Execute
      const result = await controller.initiatePaypalPayment(mockPaypalPaymentDto);

      // Assert
      expect(mockPaymentsService.initiatePaypalPayment).toHaveBeenCalledWith(mockPaypalPaymentDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('processRefund', () => {
    it('should process a refund', async () => {
      // Mock data
      const mockRefundDto = {
        paymentId: 'payment-id',
        amount: 50,
        reason: 'Partial refund requested by customer',
      };
      const mockResponse = { 
        paymentId: 'payment-id', 
        refundAmount: 50,
        providerRefundId: 'refund-id',
        success: true,
      };

      // Setup mocks
      mockPaymentsService.processRefund.mockResolvedValue(mockResponse);

      // Execute
      const result = await controller.processRefund(mockRefundDto);

      // Assert
      expect(mockPaymentsService.processRefund).toHaveBeenCalledWith(mockRefundDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('linkToRegistration', () => {
    it('should link a payment to a registration', async () => {
      // Mock data
      const paymentId = 'payment-id';
      const registrationId = 'registration-id';
      const mockPayment = { 
        id: paymentId, 
        amount: 100,
        status: PaymentStatus.COMPLETED,
        registrationId,
      };

      // Setup mocks
      mockPaymentsService.linkToRegistration.mockResolvedValue(mockPayment);

      // Execute
      const result = await controller.linkToRegistration(paymentId, registrationId);

      // Assert
      expect(mockPaymentsService.linkToRegistration).toHaveBeenCalledWith(paymentId, registrationId);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('handleStripeWebhook', () => {
    it('should handle Stripe webhook events', async () => {
      // Mock data
      const mockPayload = Buffer.from(JSON.stringify({ id: 'event-id', type: 'payment_intent.succeeded' }));
      const mockSignature = 'stripe-signature';
      const mockRequest = { rawBody: mockPayload } as RawBodyRequest<Request>;
      const mockResponse = { received: true, type: 'payment_intent.succeeded' };

      // Setup mocks
      mockPaymentsService.handleStripeWebhook.mockResolvedValue(mockResponse);

      // Execute
      const result = await controller.handleStripeWebhook(mockRequest, mockSignature);

      // Assert
      expect(mockPaymentsService.handleStripeWebhook).toHaveBeenCalledWith(mockPayload, mockSignature);
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException if signature is missing', async () => {
      // Mock data
      const mockPayload = Buffer.from(JSON.stringify({ id: 'event-id', type: 'payment_intent.succeeded' }));
      const mockRequest = { rawBody: mockPayload } as RawBodyRequest<Request>;
      const emptySignature = '';
      
      // Execute & Assert
      await expect(controller.handleStripeWebhook(mockRequest, emptySignature)).rejects.toThrow(BadRequestException);
      expect(mockPaymentsService.handleStripeWebhook).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if rawBody is missing', async () => {
      // Mock data
      const mockSignature = 'stripe-signature';
      const mockRequest = { rawBody: undefined } as RawBodyRequest<Request>;
      
      // Execute & Assert
      await expect(controller.handleStripeWebhook(mockRequest, mockSignature)).rejects.toThrow(BadRequestException);
      expect(mockPaymentsService.handleStripeWebhook).not.toHaveBeenCalled();
    });
  });

  describe('handlePaypalWebhook', () => {
    it('should handle PayPal webhook events', async () => {
      // Mock data
      const mockPayload = { id: 'event-id', event_type: 'PAYMENT.CAPTURE.COMPLETED' };
      const mockResponse = { received: true, type: 'paypal.webhook' };

      // Setup mocks
      mockPaymentsService.handlePaypalWebhook.mockResolvedValue(mockResponse);

      // Execute
      const result = await controller.handlePaypalWebhook(mockPayload);

      // Assert
      expect(mockPaymentsService.handlePaypalWebhook).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });
  });
}); 