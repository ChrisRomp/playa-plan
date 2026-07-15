import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService, StripeService, PaypalService } from '../services';
import { PaymentStatus, PaymentProvider, UserRole } from '@prisma/client';

// Mock implementations
const mockPaymentsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAllForAdmin: jest.fn(),
  findOne: jest.fn(),
  findOneWithOwnershipCheck: jest.fn(),
  update: jest.fn(),
  recordExternalPayment: jest.fn(),
  initiateStripePayment: jest.fn(),
  initiatePaypalPayment: jest.fn(),
  processRefund: jest.fn(),
  createRefund: jest.fn(),
  createManualRefund: jest.fn(),
  retryStripeRefund: jest.fn(),
  linkToRegistration: jest.fn(),
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

    describe('findAllForAdmin', () => {
      it('should return a bounded admin-safe payment list', async () => {
        const mockResponse = {
          payments: [{ id: 'payment-1', externalMethod: 'CHECK' }],
          total: 1,
        };
        mockPaymentsService.findAllForAdmin.mockResolvedValue(mockResponse);

        const actualResult = await controller.findAllForAdmin(0, 25);

        expect(mockPaymentsService.findAllForAdmin).toHaveBeenCalledWith(0, 25);
        expect(actualResult).toEqual(mockResponse);
      });
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

      const mockRequest = {
        user: {
          id: 'user-id',
          role: UserRole.ADMIN,
        },
      } as unknown as Parameters<typeof controller.findOne>[1];

      // Setup mocks
      mockPaymentsService.findOneWithOwnershipCheck.mockResolvedValue(mockPayment);

      // Execute
      const result = await controller.findOne(paymentId, mockRequest);

      // Assert
      expect(mockPaymentsService.findOneWithOwnershipCheck).toHaveBeenCalledWith(
        paymentId,
        'user-id',
        UserRole.ADMIN
      );
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

  describe('recordExternalPayment', () => {
    it('should record an external payment for the authenticated admin', async () => {
      const mockExternalPaymentDto = {
        registrationId: '7c8d0d55-e0a3-4cf0-a620-2412acd4361d',
        amount: 100,
        currency: 'USD',
        externalMethod: 'CHECK' as const,
        externalReference: 'check-123',
        idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
      };
      const mockRequest = {
        user: {
          id: 'admin-id',
          role: UserRole.ADMIN,
        },
      } as unknown as Parameters<typeof controller.recordExternalPayment>[1];
      const mockPayment = {
        id: 'payment-id',
        amount: 100,
        currency: 'USD',
        userId: 'user-id',
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.MANUAL,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPaymentsService.recordExternalPayment.mockResolvedValue(mockPayment);

      const actualResult = await controller.recordExternalPayment(
        mockExternalPaymentDto,
        mockRequest
      );

      expect(mockPaymentsService.recordExternalPayment).toHaveBeenCalledWith(
        mockExternalPaymentDto,
        'admin-id'
      );
      expect(actualResult).toEqual(mockPayment);
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

  describe('createRefund', () => {
    it.each(['MANUAL', 'STRIPE'] as const)(
      'should submit a %s refund for the authenticated admin',
      async executionMode => {
      const paymentId = '5f8d0d55-e0a3-4cf0-a620-2412acd4361c';
      const mockRefundDto = {
        amountCents: 5000,
        executionMode,
        reason: 'Partial refund completed externally',
        idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
      };
      const mockRequest = {
        user: {
          id: 'admin-id',
          role: UserRole.ADMIN,
        },
      } as unknown as Parameters<typeof controller.createRefund>[2];
      const mockResponse = {
        payment: { id: paymentId },
        refund: { id: 'refund-id', amountCents: 5000 },
        paymentAmountCents: 10000,
        successfulRefundCents: 5000,
        pendingRefundCents: 0,
        availableRefundCents: 5000,
      };

      mockPaymentsService.createRefund.mockResolvedValue(mockResponse);

      const result = await controller.createRefund(paymentId, mockRefundDto, mockRequest);

      expect(mockPaymentsService.createRefund).toHaveBeenCalledWith(
        paymentId,
        mockRefundDto,
        'admin-id'
      );
      expect(result).toEqual(mockResponse);
      }
    );

    it('should retry a pending Stripe refund without mutable refund data', async () => {
      const paymentId = '5f8d0d55-e0a3-4cf0-a620-2412acd4361c';
      const refundId = '6a9e1e88-e8c0-43f1-9fe4-a2cad9703120';
      const mockRequest = {
        user: {
          id: 'admin-id',
          role: UserRole.ADMIN,
        },
      } as unknown as Parameters<typeof controller.retryRefund>[2];
      const mockResponse = {
        payment: { id: paymentId },
        refund: { id: refundId, status: 'PENDING' },
        outcome: 'PENDING_UNKNOWN',
      };
      mockPaymentsService.retryStripeRefund.mockResolvedValue(mockResponse);

      const actualResult = await controller.retryRefund(paymentId, refundId, mockRequest);

      expect(mockPaymentsService.retryStripeRefund).toHaveBeenCalledWith(
        paymentId,
        refundId,
        'admin-id'
      );
      expect(actualResult).toEqual(mockResponse);
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
      expect(mockPaymentsService.linkToRegistration).toHaveBeenCalledWith(
        paymentId,
        registrationId
      );
      expect(result).toEqual(mockPayment);
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
