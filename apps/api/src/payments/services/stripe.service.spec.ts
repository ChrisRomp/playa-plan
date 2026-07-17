import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { CoreConfigService } from '../../core-config/services/core-config.service';

// Create a mock Stripe instance with the necessary functions
const mockStripeInstance = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
  },
  refunds: {
    create: jest.fn(),
    list: jest.fn(),
  },
};

// Mock the Stripe constructor
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

describe('StripeService', () => {
  let service: StripeService;
  let loggerSpy: { log: jest.SpyInstance; error: jest.SpyInstance; warn: jest.SpyInstance };
  
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'payment.stripe.secretKey': 'mock_secret_key',
        'payment.stripe.webhookSecret': 'mock_webhook_secret',
        'frontend.url': 'https://mycamp.playaplan.app',
      };
      return config[key as keyof typeof config];
    }),
  };

  const mockCoreConfigService = {
    findCurrent: jest.fn().mockResolvedValue({
      stripeEnabled: true,
      stripeApiKey: 'sk_test_mock_key',
    }),
  };
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CoreConfigService,
          useValue: mockCoreConfigService,
        },
      ],
    }).compile();
    
    service = module.get<StripeService>(StripeService);
    
    // Spy on the logger methods
    loggerSpy = {
      log: jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
      error: jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
      warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
    };
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  
  describe('createPaymentIntent', () => {
    it('should create a payment intent and return it', async () => {
      const paymentData = {
        userId: 'user123',
        amount: 1000,
        currency: 'usd',
        description: 'Payment for camp registration',
        registrationId: '',
      };
      const mockPaymentIntent = { id: 'pi_123', client_secret: 'secret_123' };
      
      mockStripeInstance.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      
      const result = await service.createPaymentIntent(paymentData);
      
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith({
        amount: paymentData.amount,
        currency: paymentData.currency,
        description: paymentData.description,
        metadata: { 
          userId: paymentData.userId,
          registrationId: paymentData.registrationId,
        },
      });
      
      expect(loggerSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating payment intent'),
      );
      
      expect(result).toEqual(mockPaymentIntent);
    });
    
    it('should throw an error if payment intent creation fails', async () => {
      const paymentData = {
        userId: 'user123',
        amount: 1000,
        currency: 'usd',
        description: 'Payment for camp registration',
        registrationId: '',
      };
      const mockError = new Error('Stripe API error');
      
      mockStripeInstance.paymentIntents.create.mockRejectedValue(mockError);
      
      await expect(service.createPaymentIntent(paymentData)).rejects.toThrow('Stripe API error');
      
      expect(loggerSpy.error).toHaveBeenCalledWith(
        'Failed to create payment intent: Stripe API error'
      );
    });
  });
  
  describe('createCheckoutSession', () => {
    it('should create a checkout session and return it', async () => {
      const mockSessionData = {
        userId: 'user123',
        amount: 1000,
        currency: 'usd',
        description: 'Product purchase',
        successUrl: 'https://mycamp.playaplan.app/success',
        cancelUrl: 'https://mycamp.playaplan.app/cancel',
        registrationId: '',
      };
      
      const mockSession = {
        id: 'cs_123',
        url: 'https://checkout.stripe.com/123',
      };
      
      mockStripeInstance.checkout.sessions.create.mockResolvedValue(mockSession);
      
      const result = await service.createCheckoutSession(mockSessionData);
      
      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: mockSessionData.currency,
                unit_amount: mockSessionData.amount,
                product_data: { name: mockSessionData.description },
              },
            },
          ],
          success_url: mockSessionData.successUrl,
          cancel_url: mockSessionData.cancelUrl,
          metadata: {
            userId: mockSessionData.userId,
            registrationId: mockSessionData.registrationId,
          },
        })
      );
      
      expect(loggerSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating checkout session'),
      );
      
      expect(result).toEqual(mockSession);
    });
    
    it('should throw an error if checkout session creation fails', async () => {
      const mockSessionData = {
        userId: 'user123',
        amount: 1000,
        currency: 'usd',
        description: 'Product purchase',
        successUrl: 'https://mycamp.playaplan.app/success',
        cancelUrl: 'https://mycamp.playaplan.app/cancel',
        registrationId: '',
      };
      
      const mockError = new Error('Stripe API error');
      
      mockStripeInstance.checkout.sessions.create.mockRejectedValue(mockError);
      
      await expect(service.createCheckoutSession(mockSessionData)).rejects.toThrow('Stripe API error');
      
      expect(loggerSpy.error).toHaveBeenCalledWith(
        'Failed to create checkout session: Stripe API error'
      );
    });
  });
  
  describe('createRefund', () => {
    it('should create a refund and return it', async () => {
      const paymentIntentId = 'pi_123';
      const amount = 500;
      const reason = 'requested_by_customer';
      
      const mockRefund = { id: 're_123', amount: 500 };
      
      mockStripeInstance.refunds.create.mockResolvedValue(mockRefund);
      
      const result = await service.createRefund(paymentIntentId, amount, reason);
      
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: paymentIntentId,
        amount,
        reason: 'requested_by_customer',
      });

      expect(loggerSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating refund'),
      );
      
      expect(result).toEqual(mockRefund);
    });

    it('should accept payment intent IDs directly', async () => {
      const paymentIntentId = 'pi_1234567890';
      const amount = 1000;
      const mockRefund = { id: 're_123', amount: 1000 };
      
      mockStripeInstance.refunds.create.mockResolvedValue(mockRefund);
      
      const result = await service.createRefund(paymentIntentId, amount);
      
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: paymentIntentId,
        amount,
      });
      
      expect(result).toEqual(mockRefund);
    });

    it('should convert checkout session IDs to payment intent IDs', async () => {
      const sessionId = 'cs_1234567890';
      const paymentIntentId = 'pi_0987654321';
      const amount = 1500;
      
      const mockSession = {
        id: sessionId,
        payment_intent: paymentIntentId,
      };
      const mockRefund = { id: 're_456', amount: 1500 };
      
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);
      mockStripeInstance.refunds.create.mockResolvedValue(mockRefund);
      
      const result = await service.createRefund(sessionId, amount);
      
      expect(mockStripeInstance.checkout.sessions.retrieve).toHaveBeenCalledWith(sessionId, {
        expand: ['payment_intent']
      });
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: paymentIntentId,
        amount,
      });
      
      expect(result).toEqual(mockRefund);
    });

    it('should map custom reasons to valid Stripe reasons', async () => {
      const paymentIntentId = 'pi_123';
      
      // Test duplicate reason mapping
      mockStripeInstance.refunds.create.mockResolvedValue({ id: 're_123' });
      await service.createRefund(paymentIntentId, 1000, 'duplicate payment');
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: paymentIntentId,
        amount: 1000,
        reason: 'duplicate',
      });

      // Test fraudulent reason mapping
      mockStripeInstance.refunds.create.mockClear();
      await service.createRefund(paymentIntentId, 1000, 'fraud detected');
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: paymentIntentId,
        amount: 1000,
        reason: 'fraudulent',
      });

      // Test default reason mapping
      mockStripeInstance.refunds.create.mockClear();
      await service.createRefund(paymentIntentId, 1000, 'registration cancelled');
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: paymentIntentId,
        amount: 1000,
        reason: 'requested_by_customer',
      });
    });

    it('should handle expanded payment intent objects in session response', async () => {
      const sessionId = 'cs_1234567890';
      const paymentIntentId = 'pi_0987654321';
      
      const mockSession = {
        id: sessionId,
        payment_intent: {
          id: paymentIntentId,
          status: 'succeeded',
          amount: 2000,
        },
      };
      const mockRefund = { id: 're_789', amount: 2000 };
      
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);
      mockStripeInstance.refunds.create.mockResolvedValue(mockRefund);
      
      const result = await service.createRefund(sessionId, 2000);
      
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: paymentIntentId,
        amount: 2000,
      });
      
      expect(result).toEqual(mockRefund);
    });

    it('should fail appropriately when session has no payment intent', async () => {
      const sessionId = 'cs_1234567890';
      
      const mockSession = {
        id: sessionId,
        payment_intent: null,
      };
      
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);
      
      await expect(service.createRefund(sessionId, 1000)).rejects.toThrow(
        `Checkout session ${sessionId} has no associated payment intent`
      );
      
      expect(mockStripeInstance.refunds.create).not.toHaveBeenCalled();
    });
    
    it('should throw an error if refund creation fails', async () => {
      const paymentIntentId = 'pi_123';
      const mockError = new Error('Stripe API error');
      
      mockStripeInstance.refunds.create.mockRejectedValue(mockError);
      
      await expect(service.createRefund(paymentIntentId)).rejects.toThrow('Stripe API error');
      
      expect(loggerSpy.error).toHaveBeenCalledWith(
        'Failed to process refund: Stripe API error'
      );
    });
  });

  describe('admin refunds', () => {
    const inputRequest = {
      providerRefId: 'pi_123',
      amountCents: 2500,
      reason: 'duplicate charge',
      idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
      localRefundId: 'refund-local-id',
    };

    it('should submit integer cents with stable idempotency and local metadata', async () => {
      mockStripeInstance.refunds.create.mockResolvedValue({
        id: 're_provider_id',
        status: 'succeeded',
      });

      const actualResult = await service.createAdminRefund(inputRequest);

      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith(
        {
          payment_intent: 'pi_123',
          amount: 2500,
          metadata: { paymentRefundId: 'refund-local-id' },
          reason: 'duplicate',
        },
        { idempotencyKey: inputRequest.idempotencyKey }
      );
      expect(actualResult).toEqual({
        outcome: 'SUCCEEDED',
        providerRefundId: 're_provider_id',
      });
    });

    it('should resolve a checkout session before submitting', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        payment_intent: 'pi_resolved',
      });
      mockStripeInstance.refunds.create.mockResolvedValue({
        id: 're_provider_id',
        status: 'succeeded',
      });

      await service.createAdminRefund({
        ...inputRequest,
        providerRefId: 'cs_checkout',
      });

      expect(mockStripeInstance.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_checkout', {
        expand: ['payment_intent'],
      });
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_resolved' }),
        { idempotencyKey: inputRequest.idempotencyKey }
      );
    });

    it('should classify and sanitize a definite rejection', async () => {
      mockStripeInstance.refunds.create.mockRejectedValue({
        type: 'StripeInvalidRequestError',
        message: `No such payment_intent: pi_secret ${'x'.repeat(600)}`,
      });

      const actualResult = await service.createAdminRefund(inputRequest);

      expect(actualResult.outcome).toBe('FAILED');
      if (actualResult.outcome !== 'FAILED') {
        throw new Error('Expected a definite failure');
      }
      expect(actualResult.failureMessage).not.toContain('pi_secret');
      expect(actualResult.failureMessage.length).toBeLessThanOrEqual(500);
    });

    it.each(['StripeConnectionError', 'StripeAPIError'])(
      'should classify %s as pending unknown',
      async errorType => {
        mockStripeInstance.refunds.create.mockRejectedValue({
          type: errorType,
          message: 'Transport failed',
        });

        await expect(service.createAdminRefund(inputRequest)).resolves.toEqual({
          outcome: 'PENDING_UNKNOWN',
        });
      }
    );

    it('should keep a rate-limited refund pending for retry', async () => {
      mockStripeInstance.refunds.create.mockRejectedValue({
        type: 'StripeRateLimitError',
        message: 'Too many requests',
      });

      await expect(service.createAdminRefund(inputRequest)).resolves.toEqual({
        outcome: 'PENDING_UNKNOWN',
      });
    });

    it('should keep a concurrent idempotency conflict pending', async () => {
      mockStripeInstance.refunds.create.mockRejectedValue({
        type: 'StripeIdempotencyError',
        message: 'Another request with this key is executing',
      });

      await expect(service.createAdminRefund(inputRequest)).resolves.toEqual({
        outcome: 'PENDING_UNKNOWN',
      });
    });

    it.each([
      ['pending', 'PENDING_UNKNOWN'],
      ['requires_action', 'PENDING_UNKNOWN'],
      ['failed', 'FAILED'],
      ['canceled', 'FAILED'],
    ] as const)('should classify Stripe refund status %s as %s', async (status, outcome) => {
      mockStripeInstance.refunds.create.mockResolvedValue({
        id: 're_provider_id',
        status,
      });

      const actualResult = await service.createAdminRefund(inputRequest);

      expect(actualResult.outcome).toBe(outcome);
    });

    it('should find an existing refund by local metadata', async () => {
      mockStripeInstance.refunds.list.mockResolvedValue({
        has_more: false,
        data: [
          {
            id: 're_other',
            status: 'succeeded',
            metadata: { paymentRefundId: 'other-refund' },
          },
          {
            id: 're_match',
            status: 'succeeded',
            metadata: { paymentRefundId: inputRequest.localRefundId },
          },
        ],
      });

      const actualResult = await service.findAdminRefund(
        inputRequest.providerRefId,
        inputRequest.localRefundId
      );

      expect(mockStripeInstance.refunds.list).toHaveBeenCalledWith({
        payment_intent: inputRequest.providerRefId,
        limit: 100,
      });
      expect(actualResult).toEqual({
        outcome: 'FOUND',
        providerRefundId: 're_match',
      });
    });

    it('should find a matching refund on a later page', async () => {
      mockStripeInstance.refunds.list
        .mockResolvedValueOnce({
          has_more: true,
          data: [
            {
              id: 're_first_page',
              status: 'succeeded',
              metadata: { paymentRefundId: 'other-refund' },
            },
          ],
        })
        .mockResolvedValueOnce({
          has_more: false,
          data: [
            {
              id: 're_later_match',
              status: 'succeeded',
              metadata: { paymentRefundId: inputRequest.localRefundId },
            },
          ],
        });

      await expect(
        service.findAdminRefund(inputRequest.providerRefId, inputRequest.localRefundId)
      ).resolves.toEqual({
        outcome: 'FOUND',
        providerRefundId: 're_later_match',
      });
      expect(mockStripeInstance.refunds.list).toHaveBeenNthCalledWith(2, {
        payment_intent: inputRequest.providerRefId,
        limit: 100,
        starting_after: 're_first_page',
      });
    });

    it('should report not found only after every page is inspected', async () => {
      mockStripeInstance.refunds.list
        .mockResolvedValueOnce({
          has_more: true,
          data: [
            {
              id: 're_first_page',
              status: 'succeeded',
              metadata: { paymentRefundId: 'other-refund' },
            },
          ],
        })
        .mockResolvedValueOnce({
          has_more: false,
          data: [
            {
              id: 're_last_page',
              status: 'succeeded',
              metadata: { paymentRefundId: 'another-refund' },
            },
          ],
        });

      await expect(
        service.findAdminRefund(inputRequest.providerRefId, inputRequest.localRefundId)
      ).resolves.toEqual({ outcome: 'NOT_FOUND' });
      expect(mockStripeInstance.refunds.list).toHaveBeenCalledTimes(2);
    });

    it('should preserve pending state when a later page cannot be inspected', async () => {
      mockStripeInstance.refunds.list
        .mockResolvedValueOnce({
          has_more: true,
          data: [
            {
              id: 're_first_page',
              status: 'succeeded',
              metadata: { paymentRefundId: 'other-refund' },
            },
          ],
        })
        .mockRejectedValueOnce({
          type: 'StripeConnectionError',
          message: 'Connection reset',
        });

      await expect(
        service.findAdminRefund(inputRequest.providerRefId, inputRequest.localRefundId)
      ).resolves.toEqual({ outcome: 'PENDING_UNKNOWN' });
    });

    it('should not finalize a matching non-successful inspected refund', async () => {
      mockStripeInstance.refunds.list.mockResolvedValue({
        has_more: false,
        data: [
          {
            id: 're_pending',
            status: 'pending',
            metadata: { paymentRefundId: inputRequest.localRefundId },
          },
        ],
      });

      await expect(
        service.findAdminRefund(inputRequest.providerRefId, inputRequest.localRefundId)
      ).resolves.toEqual({ outcome: 'PENDING_UNKNOWN' });
    });

    it('should preserve pending state when inspection is ambiguous', async () => {
      mockStripeInstance.refunds.list.mockRejectedValue({
        type: 'StripeConnectionError',
        message: 'Connection reset',
      });

      await expect(
        service.findAdminRefund(inputRequest.providerRefId, inputRequest.localRefundId)
      ).resolves.toEqual({ outcome: 'PENDING_UNKNOWN' });
    });
  });

  describe('getPaymentIntent', () => {
    it('should retrieve a payment intent by ID', async () => {
      const paymentIntentId = 'pi_123';
      const mockPaymentIntent = { id: 'pi_123', status: 'succeeded' };
      
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
      
      const result = await service.getPaymentIntent(paymentIntentId);
      
      expect(mockStripeInstance.paymentIntents.retrieve).toHaveBeenCalledWith(paymentIntentId);
      expect(result).toEqual(mockPaymentIntent);
    });
    
    it('should throw an error if payment intent retrieval fails', async () => {
      const paymentIntentId = 'pi_123';
      const mockError = new Error('Stripe API error');
      
      mockStripeInstance.paymentIntents.retrieve.mockRejectedValue(mockError);
      
      await expect(service.getPaymentIntent(paymentIntentId)).rejects.toThrow('Stripe API error');
      
      expect(loggerSpy.error).toHaveBeenCalledWith(
        'Failed to retrieve payment intent: Stripe API error'
      );
    });
  });

  describe('getCheckoutSession', () => {
    it('should expand payment intent data correctly', async () => {
      const sessionId = 'cs_1234567890';
      const mockSession = {
        id: sessionId,
        payment_intent: {
          id: 'pi_0987654321',
          status: 'succeeded',
          amount: 2000,
        },
      };
      
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(mockSession);
      
      const result = await service.getCheckoutSession(sessionId);
      
      expect(mockStripeInstance.checkout.sessions.retrieve).toHaveBeenCalledWith(sessionId, {
        expand: ['payment_intent']
      });
      
      expect(result).toEqual(mockSession);
    });

    it('should handle checkout session retrieval errors appropriately', async () => {
      const sessionId = 'cs_invalid';
      const mockError = new Error('No such checkout session');
      
      mockStripeInstance.checkout.sessions.retrieve.mockRejectedValue(mockError);
      
      await expect(service.getCheckoutSession(sessionId)).rejects.toThrow('No such checkout session');
      
      expect(loggerSpy.error).toHaveBeenCalledWith(
        'Failed to retrieve checkout session: No such checkout session'
      );
    });
  });
}); 