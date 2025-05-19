import { Test, TestingModule } from '@nestjs/testing';
import { PaypalService } from './paypal.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { CreatePaypalPaymentDto } from '../dto/create-paypal-payment.dto';

// Define types for fetch
interface FetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

describe('PaypalService', () => {
  let service: PaypalService;
  let loggerSpy: { log: jest.SpyInstance; error: jest.SpyInstance; warn: jest.SpyInstance };
  let originalFetch: typeof global.fetch;
  let mockFetch: jest.Mock;
  
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'payment.paypal.clientId': 'test-client-id',
        'payment.paypal.clientSecret': 'test-client-secret',
        'payment.paypal.mode': 'sandbox',
        'frontend.url': 'https://mycamp.playaplan.app',
      };
      return config[key as keyof typeof config];
    }),
  };
  
  // Mock responses
  const mockAccessTokenResponse = {
    access_token: 'test-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
  };
  
  const mockOrderResponse = {
    id: 'test-order-id',
    status: 'CREATED',
    links: [
      {
        href: 'https://api.sandbox.paypal.com/v2/checkout/orders/test-order-id',
        rel: 'self',
        method: 'GET',
      },
      {
        href: 'https://www.sandbox.paypal.com/checkoutnow?token=test-order-id',
        rel: 'approve',
        method: 'GET',
      },
    ],
  };
  
  const mockCaptureResponse = {
    id: 'test-order-id',
    status: 'COMPLETED',
    purchase_units: [
      {
        payments: {
          captures: [
            {
              id: 'test-capture-id',
              status: 'COMPLETED',
              amount: {
                value: '100.00',
                currency_code: 'USD',
              },
            },
          ],
        },
      },
    ],
  };
  
  const mockRefundResponse = {
    id: 'test-refund-id',
    status: 'COMPLETED',
    links: [],
  };
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Save original fetch and replace with mock
    originalFetch = global.fetch;
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();
    
    service = module.get<PaypalService>(PaypalService);
    
    // Spy on the logger methods
    loggerSpy = {
      log: jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
      error: jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
      warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
    };
  });
  
  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });
  
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  
  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      // Mock for access token
      const tokenResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockAccessTokenResponse),
      };
      
      // Mock for createOrder
      const orderResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockOrderResponse),
      };
      
      // Set up the fetch mock to return different responses for different requests
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve(tokenResponse);
        }
        if (url.includes('/v2/checkout/orders')) {
          return Promise.resolve(orderResponse);
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      
      const paymentData: CreatePaypalPaymentDto = {
        userId: 'user123',
        amount: 100,
        currency: 'USD',
        itemDescription: 'Test payment',
        successUrl: 'https://mycamp.playaplan.app/success',
        cancelUrl: 'https://mycamp.playaplan.app/cancel',
        registrationId: '',
      };
      
      const result = await service.createOrder(paymentData);
      
      // Verify token request was made
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: expect.any(String),
          }),
        })
      );
      
      // Verify order creation request
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api-m.sandbox.paypal.com/v2/checkout/orders',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-access-token',
          }),
          body: expect.any(String),
        })
      );
      
      expect(result).toEqual(mockOrderResponse);
      expect(loggerSpy.log).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('Creating PayPal order for user user123')
      );
      expect(loggerSpy.log).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('Created PayPal order test-order-id')
      );
    });
    
    it('should throw an error if access token request fails', async () => {
      // Mock for access token failure
      const tokenErrorResponse: Partial<FetchResponse> = {
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ error: 'invalid_client', error_description: 'Client Authentication failed' }),
      };
      
      mockFetch.mockResolvedValue(tokenErrorResponse);
      
      const paymentData: CreatePaypalPaymentDto = {
        userId: 'user123',
        amount: 100,
        currency: 'USD',
        itemDescription: 'Test payment',
        successUrl: 'https://mycamp.playaplan.app/success',
        cancelUrl: 'https://mycamp.playaplan.app/cancel',
        registrationId: '',
      };
      
      await expect(service.createOrder(paymentData)).rejects.toThrow('PayPal access token error: Client Authentication failed');
      expect(loggerSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get PayPal access token'),
        expect.any(String)
      );
    });
    
    it('should throw an error if order creation fails', async () => {
      // Mock for access token
      const tokenResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockAccessTokenResponse),
      };
      
      // Mock for createOrder failure
      const errorResponse: Partial<FetchResponse> = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ name: 'VALIDATION_ERROR', details: [{ issue: 'Invalid request' }] }),
      };
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve(tokenResponse);
        }
        if (url.includes('/v2/checkout/orders')) {
          return Promise.resolve(errorResponse);
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      
      const paymentData: CreatePaypalPaymentDto = {
        userId: 'user123',
        amount: 100,
        currency: 'USD',
        itemDescription: 'Test payment',
        successUrl: 'https://mycamp.playaplan.app/success',
        cancelUrl: 'https://mycamp.playaplan.app/cancel',
        registrationId: '',
      };
      
      await expect(service.createOrder(paymentData)).rejects.toThrow('PayPal order creation error:');
      expect(loggerSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create PayPal order'),
        expect.any(String)
      );
    });
  });
  
  describe('capturePayment', () => {
    it('should capture a payment successfully', async () => {
      // Mock for access token
      const tokenResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockAccessTokenResponse),
      };
      
      // Mock for capturePayment
      const captureResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockCaptureResponse),
      };
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve(tokenResponse);
        }
        if (url.includes('/capture')) {
          return Promise.resolve(captureResponse);
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      
      const orderId = 'test-order-id';
      const result = await service.capturePayment(orderId);
      
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api-m.sandbox.paypal.com/v2/checkout/orders/test-order-id/capture',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-access-token',
          }),
        })
      );
      
      expect(result).toEqual(mockCaptureResponse);
      expect(loggerSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Capturing payment for PayPal order test-order-id')
      );
    });
    
    it('should throw an error if payment capture fails', async () => {
      // Mock for access token
      const tokenResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockAccessTokenResponse),
      };
      
      // Mock for capturePayment failure
      const errorResponse: Partial<FetchResponse> = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'Order already captured' }] }),
      };
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve(tokenResponse);
        }
        if (url.includes('/capture')) {
          return Promise.resolve(errorResponse);
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      
      const orderId = 'test-order-id';
      await expect(service.capturePayment(orderId)).rejects.toThrow('PayPal payment capture error:');
      expect(loggerSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to capture PayPal payment'),
        expect.any(String)
      );
    });
  });
  
  describe('getOrderDetails', () => {
    it('should get order details successfully', async () => {
      // Mock for access token
      const tokenResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockAccessTokenResponse),
      };
      
      // Mock for getOrderDetails
      const orderResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockOrderResponse),
      };
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve(tokenResponse);
        }
        if (url.includes('/v2/checkout/orders/')) {
          return Promise.resolve(orderResponse);
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      
      const orderId = 'test-order-id';
      const result = await service.getOrderDetails(orderId);
      
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api-m.sandbox.paypal.com/v2/checkout/orders/test-order-id',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        })
      );
      
      expect(result).toEqual(mockOrderResponse);
      // No log assertion as the getOrderDetails method doesn't log on success
    });
    
    it('should throw an error if getting order details fails', async () => {
      // Mock for access token
      const tokenResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockAccessTokenResponse),
      };
      
      // Mock for getOrderDetails failure
      const errorResponse: Partial<FetchResponse> = {
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({ name: 'RESOURCE_NOT_FOUND', details: [{ issue: 'Order not found' }] }),
      };
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve(tokenResponse);
        }
        if (url.includes('/v2/checkout/orders/')) {
          return Promise.resolve(errorResponse);
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      
      const orderId = 'test-order-id';
      await expect(service.getOrderDetails(orderId)).rejects.toThrow('PayPal order details error:');
      expect(loggerSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get PayPal order details'),
        expect.any(String)
      );
    });
  });
  
  describe('createRefund', () => {
    it('should create a refund successfully', async () => {
      // Mock for access token
      const tokenResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockAccessTokenResponse),
      };
      
      // Mock for createRefund
      const refundResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockRefundResponse),
      };
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve(tokenResponse);
        }
        if (url.includes('/refund')) {
          return Promise.resolve(refundResponse);
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      
      const captureId = 'test-capture-id';
      const amount = 100;
      const currency = 'USD';
      const result = await service.createRefund(captureId, amount, currency);
      
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api-m.sandbox.paypal.com/v2/payments/captures/test-capture-id/refund',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-access-token',
          }),
          body: expect.stringMatching(/.*"amount".*"value":"100".*"currency_code":"USD".*/)
        })
      );
      
      expect(result).toEqual(mockRefundResponse);
      expect(loggerSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating refund for PayPal capture test-capture-id')
      );
    });
    
    it('should throw an error if refund creation fails', async () => {
      // Mock for access token
      const tokenResponse: Partial<FetchResponse> = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockAccessTokenResponse),
      };
      
      // Mock for createRefund failure
      const errorResponse: Partial<FetchResponse> = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ name: 'RESOURCE_NOT_FOUND', details: [{ issue: 'Capture not found' }] }),
      };
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/v1/oauth2/token')) {
          return Promise.resolve(tokenResponse);
        }
        if (url.includes('/refund')) {
          return Promise.resolve(errorResponse);
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });
      
      const captureId = 'test-capture-id';
      const amount = 100;
      const currency = 'USD';
      await expect(service.createRefund(captureId, amount, currency)).rejects.toThrow('PayPal refund error:');
      expect(loggerSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process PayPal refund'),
        expect.any(String)
      );
    });
  });
}); 