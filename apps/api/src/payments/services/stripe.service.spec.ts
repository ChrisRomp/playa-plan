import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// Create a mock Stripe instance with the necessary functions
const mockStripeInstance = {
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

// Mock the Stripe constructor
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

// Import Stripe after mocking
import Stripe from 'stripe';

describe('StripeService', () => {
  let service: StripeService;
  let loggerSpy: { log: jest.SpyInstance; error: jest.SpyInstance; warn: jest.SpyInstance };
  
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'payment.stripe.secretKey': 'mock_secret_key',
        'payment.stripe.webhookSecret': 'mock_webhook_secret',
        'frontend.url': 'https://example.com',
      };
      return config[key as keyof typeof config];
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
        expect.stringContaining('Failed to create payment intent'),
        expect.any(String),
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
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
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
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        registrationId: '',
      };
      
      const mockError = new Error('Stripe API error');
      
      mockStripeInstance.checkout.sessions.create.mockRejectedValue(mockError);
      
      await expect(service.createCheckoutSession(mockSessionData)).rejects.toThrow('Stripe API error');
      
      expect(loggerSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create checkout session'),
        expect.any(String),
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
        reason,
      });
      
      expect(loggerSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating refund'),
      );
      
      expect(result).toEqual(mockRefund);
    });
    
    it('should throw an error if refund creation fails', async () => {
      const paymentIntentId = 'pi_123';
      const mockError = new Error('Stripe API error');
      
      mockStripeInstance.refunds.create.mockRejectedValue(mockError);
      
      await expect(service.createRefund(paymentIntentId)).rejects.toThrow('Stripe API error');
      
      expect(loggerSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process refund'),
        expect.any(String),
      );
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
        expect.stringContaining('Failed to retrieve payment intent'),
        expect.any(String),
      );
    });
  });
  
  describe('constructEventFromWebhook', () => {
    it('should construct and return a webhook event', async () => {
      const mockPayload = Buffer.from('{}');
      const mockSignature = 'sig_123';
      const mockEvent = { type: 'payment_intent.succeeded', data: { object: {} } };
      
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);
      
      const result = await service.constructEventFromWebhook(mockPayload, mockSignature);
      
      expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        mockPayload,
        mockSignature,
        'mock_webhook_secret',
      );
      
      expect(result).toEqual(mockEvent);
    });
    
    it('should throw an error if webhook event construction fails', async () => {
      const mockPayload = Buffer.from('{}');
      const mockSignature = 'sig_123';
      const mockError = new Error('Invalid signature');
      
      mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw mockError;
      });
      
      await expect(service.constructEventFromWebhook(mockPayload, mockSignature)).rejects.toThrow('Invalid signature');
      
      expect(loggerSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to verify webhook'),
        expect.any(String),
      );
    });
  });
}); 