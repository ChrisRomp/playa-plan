import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService, StripeService, PaypalService } from '../services';
import { PaymentStatus, PaymentProvider, UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../../auth/types/safe-user';

// Mock implementations
const mockPaymentsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findOneWithOwnershipCheck: jest.fn(),
  update: jest.fn(),
  recordManualPayment: jest.fn(),
  initiateStripePayment: jest.fn(),
  initiatePaypalPayment: jest.fn(),
  processRefund: jest.fn(),
  reconcilePendingRefund: jest.fn(),
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
    it('should create a payment record using the authenticated user as the recording actor', async () => {
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
      const mockRequest = { user: { id: 'admin-id', role: UserRole.ADMIN } } as AuthenticatedRequest;

      // Setup mocks
      mockPaymentsService.create.mockResolvedValue(mockPayment);

      // Execute
      const result = await controller.createPayment(mockPaymentDto, mockRequest);

      // Assert
      expect(mockPaymentsService.create).toHaveBeenCalledWith(mockPaymentDto, 'admin-id');
      expect(result).toEqual(mockPayment);
    });

    it('should not allow the request body to override the authenticated recording actor', async () => {
      // A caller attempts to attribute the payment to a different user via the DTO;
      // CreatePaymentDto has no recordedByUserId field, so this extra property must
      // be ignored and only the authenticated req.user.id is passed to the service.
      const mockPaymentDto = {
        amount: 100,
        currency: 'USD',
        provider: PaymentProvider.STRIPE,
        userId: 'user-id',
        providerRefId: 'provider-ref-id',
        recordedByUserId: 'spoofed-admin-id',
      };
      const mockRequest = { user: { id: 'real-admin-id', role: UserRole.ADMIN } } as AuthenticatedRequest;

      mockPaymentsService.create.mockResolvedValue({ id: 'payment-id' });

      await controller.createPayment(mockPaymentDto, mockRequest);

      expect(mockPaymentsService.create).toHaveBeenCalledWith(mockPaymentDto, 'real-admin-id');
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
      const result = await controller.findAll({ skip: 0, take: 10 });

      // Assert
      expect(mockPaymentsService.findAll).toHaveBeenCalledWith(0, 10, undefined, undefined, undefined, undefined, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should apply filters when provided', async () => {
      // Mock data
      const mockPayments = [{ id: 'payment-1', amount: 100 }];
      const mockTotal = 1;
      const mockResponse = { payments: mockPayments, total: mockTotal };
      const skip = 0;
      const take = 10;
      const userId = 'user-id';
      const status = PaymentStatus.COMPLETED;

      // Setup mocks
      mockPaymentsService.findAll.mockResolvedValue(mockResponse);

      // Execute
      const result = await controller.findAll({ skip, take, userId, status });

      // Assert
      expect(mockPaymentsService.findAll).toHaveBeenCalledWith(0, 10, userId, status, undefined, undefined, undefined);
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
          role: UserRole.ADMIN 
        }
      } as unknown as Parameters<typeof controller.findOne>[1];

      // Setup mocks
      mockPaymentsService.findOneWithOwnershipCheck.mockResolvedValue(mockPayment);

      // Execute
      const result = await controller.findOne(paymentId, mockRequest);

      // Assert
      expect(mockPaymentsService.findOneWithOwnershipCheck).toHaveBeenCalledWith(paymentId, 'user-id', UserRole.ADMIN);
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
        provider: PaymentProvider.MANUAL,
        providerRefId: null,
        externalPaymentMethod: 'Cash',
        externalPaymentReference: 'Cash payment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockRequest = {
        user: {
          id: 'admin-id',
          role: UserRole.ADMIN,
        },
      } as unknown as Parameters<typeof controller.recordManualPayment>[1];

      // Setup mocks
      mockPaymentsService.recordManualPayment.mockResolvedValue(mockPayment);

      // Execute
      const result = await controller.recordManualPayment(mockManualPaymentDto, mockRequest);

      // Assert
      expect(mockPaymentsService.recordManualPayment).toHaveBeenCalledWith(mockManualPaymentDto, 'admin-id');
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
      const mockRequest = {
        user: {
          id: 'admin-id',
          role: UserRole.ADMIN,
        },
      } as unknown as Parameters<typeof controller.processRefund>[1];

      // Setup mocks
      mockPaymentsService.processRefund.mockResolvedValue(mockResponse);

      // Execute
      const result = await controller.processRefund(mockRefundDto, mockRequest);

      // Assert
      expect(mockPaymentsService.processRefund).toHaveBeenCalledWith(mockRefundDto, 'admin-id');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('reconcileRefund', () => {
    it('should reconcile pending processor refunds and pass the authenticated actor to the service', async () => {
      // Mock data
      const paymentId = 'payment-id';
      const mockResponse = {
        payment: {
          id: paymentId,
          status: PaymentStatus.REFUNDED,
        },
        reconciledRefundIds: ['refund-id'],
      };
      const mockRequest = {
        user: { id: 'admin-id', role: UserRole.ADMIN },
      } as AuthenticatedRequest;

      // Setup mocks
      mockPaymentsService.reconcilePendingRefund.mockResolvedValue(mockResponse);

      // Execute
      const result = await controller.reconcileRefund(paymentId, mockRequest);

      // Assert
      expect(mockPaymentsService.reconcilePendingRefund).toHaveBeenCalledWith(paymentId, 'admin-id');
      expect(result).toEqual(mockResponse);
    });

    it('should attribute reconciliation to the second admin, not the original refund submitter', async () => {
      // A second admin reconciles a refund originally submitted by a different admin;
      // the service must be called with the second admin's ID, not the first admin's.
      const paymentId = 'payment-id';
      const mockResponse = {
        payment: { id: paymentId, status: PaymentStatus.REFUNDED },
        reconciledRefundIds: ['refund-id'],
      };
      const secondAdminRequest = {
        user: { id: 'second-admin-id', role: UserRole.ADMIN },
      } as AuthenticatedRequest;

      mockPaymentsService.reconcilePendingRefund.mockResolvedValue(mockResponse);

      const result = await controller.reconcileRefund(paymentId, secondAdminRequest);

      expect(mockPaymentsService.reconcilePendingRefund).toHaveBeenCalledWith(paymentId, 'second-admin-id');
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