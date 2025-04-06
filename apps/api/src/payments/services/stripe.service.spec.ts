import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import Stripe from 'stripe';

// Mock Stripe
jest.mock('stripe');

describe('StripeService', () => {
  let service: StripeService;
  let mockConfigService: any;
  let mockStripeInstance: any;

  beforeEach(async () => {
    // Mock Stripe constructor and methods
    mockStripeInstance = {
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      checkout: {
        sessions: {
          create: jest.fn(),
        },
      },
      refunds: {
        create: jest.fn(),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    };

    (Stripe as jest.Mock).mockImplementation(() => mockStripeInstance);

    // Mock ConfigService
    mockConfigService = {
      get: jest.fn().mockImplementation((key) => {
        const config = {
          'stripe.secretKey': 'mock_stripe_secret_key',
          'stripe.webhookSecret': 'mock_stripe_webhook_secret',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    
    // Spy on logger to prevent console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent successfully', async () => {
      // Mock data
      const userId = 'user-123';
      const amount = 1000;
      const currency = 'usd';
      const mockPaymentIntent = {
        id: 'pi_123456',
        amount,
        currency,
        client_secret: 'secret_123',
        status: 'requires_payment_method',
      };

      // Setup mocks
      mockStripeInstance.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Execute
      const result = await service.createPaymentIntent(userId, amount, currency);

      // Assert
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith({
        amount,
        currency,
        metadata: { userId },
      });
      expect(result).toEqual(mockPaymentIntent);
    });

    it('should handle errors when creating payment intent', async () => {
      // Mock data
      const userId = 'user-123';
      const amount = 1000;
      const currency = 'usd';
      const mockError = new Error('Stripe API Error');

      // Setup mocks
      mockStripeInstance.paymentIntents.create.mockRejectedValue(mockError);

      // Execute & Assert
      await expect(service.createPaymentIntent(userId, amount, currency))
        .rejects.toThrow(mockError);
    });
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session successfully', async () => {
      // Mock data
      const mockSessionData = {
        userId: 'user-123',
        amount: 10000, // In cents
        currency: 'usd',
        description: 'Test payment',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };
      const mockSession = {
        id: 'cs_123456',
        url: 'https://checkout.stripe.com/pay/cs_123456',
        payment_intent: 'pi_123456',
      };

      // Setup mocks
      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);

      // Execute
      const result = await service.createCheckoutSession(mockSessionData);

      // Assert
      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card'],
          line_items: expect.any(Array),
          success_url: mockSessionData.successUrl,
          cancel_url: mockSessionData.cancelUrl,
          metadata: { userId: mockSessionData.userId },
        })
      );
      expect(result).toEqual(mockSession);
    });

    it('should handle errors when creating checkout session', async () => {
      // Mock data
      const mockSessionData = {
        userId: 'user-123',
        amount: 10000,
        currency: 'usd',
        description: 'Test payment',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };
      const mockError = new Error('Stripe API Error');

      // Setup mocks
      mockStripeInstance.checkout.sessions.create.mockRejectedValue(mockError);

      // Execute & Assert
      await expect(service.createCheckoutSession(mockSessionData))
        .rejects.toThrow(mockError);
    });
  });

  describe('createRefund', () => {
    it('should create a refund successfully', async () => {
      // Mock data
      const paymentIntentId = 'pi_123456';
      const amount = 1000;
      const reason = 'requested_by_customer';
      const mockRefund = {
        id: 're_123456',
        amount,
        payment_intent: paymentIntentId,
        reason,
        status: 'succeeded',
      };

      // Setup mocks
      mockStripeInstance.refunds.create.mockResolvedValue(mockRefund);

      // Execute
      const result = await service.createRefund(paymentIntentId, amount, reason);

      // Assert
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: paymentIntentId,
        amount,
        reason,
      });
      expect(result).toEqual(mockRefund);
    });

    it('should handle errors when creating refund', async () => {
      // Mock data
      const paymentIntentId = 'pi_123456';
      const amount = 1000;
      const reason = 'requested_by_customer';
      const mockError = new Error('Stripe API Error');

      // Setup mocks
      mockStripeInstance.refunds.create.mockRejectedValue(mockError);

      // Execute & Assert
      await expect(service.createRefund(paymentIntentId, amount, reason))
        .rejects.toThrow(mockError);
    });
  });

  describe('getPaymentIntent', () => {
    it('should retrieve a payment intent successfully', async () => {
      // Mock data
      const paymentIntentId = 'pi_123456';
      const mockPaymentIntent = {
        id: paymentIntentId,
        amount: 1000,
        currency: 'usd',
        status: 'succeeded',
      };

      // Setup mocks
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      // Execute
      const result = await service.getPaymentIntent(paymentIntentId);

      // Assert
      expect(mockStripeInstance.paymentIntents.retrieve).toHaveBeenCalledWith(paymentIntentId);
      expect(result).toEqual(mockPaymentIntent);
    });

    it('should handle errors when retrieving payment intent', async () => {
      // Mock data
      const paymentIntentId = 'pi_123456';
      const mockError = new Error('Stripe API Error');

      // Setup mocks
      mockStripeInstance.paymentIntents.retrieve.mockRejectedValue(mockError);

      // Execute & Assert
      await expect(service.getPaymentIntent(paymentIntentId))
        .rejects.toThrow(mockError);
    });
  });

  describe('constructEventFromWebhook', () => {
    it('should construct event from webhook payload successfully', async () => {
      // Mock data
      const payload = Buffer.from(JSON.stringify({ id: 'evt_123456', type: 'payment_intent.succeeded' }));
      const signature = 'mock_signature';
      const mockEvent = {
        id: 'evt_123456',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123456',
            status: 'succeeded',
          },
        },
      };

      // Setup mocks
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Execute
      const result = await service.constructEventFromWebhook(payload, signature);

      // Assert
      expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'mock_stripe_webhook_secret'
      );
      expect(result).toEqual(mockEvent);
    });

    it('should handle errors when constructing event from webhook', async () => {
      // Mock data
      const payload = Buffer.from(JSON.stringify({ id: 'evt_123456', type: 'payment_intent.succeeded' }));
      const signature = 'invalid_signature';
      const mockError = new Error('Invalid signature');

      // Setup mocks
      mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw mockError;
      });

      // Execute & Assert
      await expect(service.constructEventFromWebhook(payload, signature))
        .rejects.toThrow(mockError);
    });
  });
}); 