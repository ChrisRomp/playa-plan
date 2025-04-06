import { Test, TestingModule } from '@nestjs/testing';
import { PaypalService } from './paypal.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe('PaypalService', () => {
  let service: PaypalService;
  
  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
  
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'payment.paypal.clientId': 'mock_client_id',
        'payment.paypal.clientSecret': 'mock_client_secret',
        'payment.paypal.mode': 'sandbox',
      };
      return config[key as keyof typeof config];
    }),
  };
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();
    
    service = module.get<PaypalService>(PaypalService);
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  
  describe('createOrder', () => {
    it('should create a PayPal order and return it', async () => {
      // Mock fetch responses for both token and order creation
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock_access_token' }),
        })
      );
      
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'order_123',
            status: 'CREATED',
            links: [
              { rel: 'self', href: 'https://api.sandbox.paypal.com/v2/checkout/orders/order_123' },
              { rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=order_123' },
              { rel: 'update', href: 'https://api.sandbox.paypal.com/v2/checkout/orders/order_123' },
              { rel: 'capture', href: 'https://api.sandbox.paypal.com/v2/checkout/orders/order_123/capture' },
            ],
          }),
        })
      );
      
      const orderData = {
        userId: 'user123',
        amount: 99.99,
        currency: 'USD',
        itemDescription: 'Product purchase',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        registrationId: 'reg_123',
      };
      
      const result = await service.createOrder(orderData);
      
      // Verify fetch was called twice (token + order creation)
      expect(fetch).toHaveBeenCalledTimes(2);
      
      // First call for access token
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object),
          body: 'grant_type=client_credentials',
        })
      );
      
      // Second call for order creation
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://api-m.sandbox.paypal.com/v2/checkout/orders',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object),
          body: expect.any(String),
        })
      );
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Created PayPal order'),
      );
      
      expect(result).toEqual(expect.objectContaining({
        id: 'order_123',
        status: 'CREATED',
      }));
    });
    
    it('should throw an error if order creation fails', async () => {
      // Mock fetch for successful token but failed order
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock_access_token' }),
        })
      );
      
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'invalid_request', error_description: 'PayPal API error' }),
        })
      );
      
      const orderData = {
        userId: 'user123',
        amount: 99.99,
        currency: 'USD',
        itemDescription: 'Product purchase',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };
      
      await expect(service.createOrder(orderData)).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create PayPal order'),
        expect.any(String),
      );
    });
  });
  
  describe('capturePayment', () => {
    it('should capture a payment for an approved order', async () => {
      // Mock fetch responses for both token and capture
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock_access_token' }),
        })
      );
      
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'order_123',
            status: 'COMPLETED',
            purchase_units: [
              {
                payments: {
                  captures: [
                    { id: 'capture_123', status: 'COMPLETED', amount: { value: '99.99', currency_code: 'USD' } }
                  ]
                }
              }
            ],
          }),
        })
      );
      
      const orderId = 'order_123';
      
      const result = await service.capturePayment(orderId);
      
      // Verify fetch was called twice (token + capture)
      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Second call for payment capture
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://api-m.sandbox.paypal.com/v2/checkout/orders/order_123/capture',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object),
        })
      );
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Captured payment for order'),
      );
      
      expect(result).toEqual(expect.objectContaining({
        id: 'order_123',
        status: 'COMPLETED',
      }));
    });
    
    it('should throw an error if payment capture fails', async () => {
      // Mock fetch for successful token but failed capture
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock_access_token' }),
        })
      );
      
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'invalid_request', error_description: 'PayPal API error' }),
        })
      );
      
      const orderId = 'order_123';
      
      await expect(service.capturePayment(orderId)).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to capture PayPal payment'),
        expect.any(String),
      );
    });
  });
  
  describe('getOrderDetails', () => {
    it('should retrieve order details by ID', async () => {
      // Mock fetch responses for both token and order details
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock_access_token' }),
        })
      );
      
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'order_123',
            status: 'CREATED',
            purchase_units: [
              { amount: { value: '99.99', currency_code: 'USD' } }
            ],
          }),
        })
      );
      
      const orderId = 'order_123';
      
      const result = await service.getOrderDetails(orderId);
      
      // Verify fetch was called twice (token + get details)
      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Second call for order details
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://api-m.sandbox.paypal.com/v2/checkout/orders/order_123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object),
        })
      );
      
      expect(result).toEqual(expect.objectContaining({
        id: 'order_123',
        status: 'CREATED',
        purchase_units: expect.any(Array),
      }));
    });
    
    it('should throw an error if getting order details fails', async () => {
      // Mock fetch for successful token but failed details
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock_access_token' }),
        })
      );
      
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'invalid_request', error_description: 'PayPal API error' }),
        })
      );
      
      const orderId = 'order_123';
      
      await expect(service.getOrderDetails(orderId)).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get PayPal order details'),
        expect.any(String),
      );
    });
  });
  
  describe('createRefund', () => {
    it('should create a refund and return it', async () => {
      // Mock fetch responses for both token and refund
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock_access_token' }),
        })
      );
      
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'refund_123',
            status: 'COMPLETED',
            amount: { value: '50.00', currency_code: 'USD' },
            links: [],
          }),
        })
      );
      
      const captureId = 'capture_123';
      const amount = 50.00;
      const note = 'Customer requested refund';
      
      const result = await service.createRefund(captureId, amount, note);
      
      // Verify fetch was called twice (token + refund creation)
      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Second call for refund creation
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://api-m.sandbox.paypal.com/v2/payments/captures/capture_123/refund',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object),
          body: expect.any(String),
        })
      );
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating refund for PayPal capture'),
      );
      
      expect(result).toEqual(expect.objectContaining({
        id: 'refund_123',
        status: 'COMPLETED',
      }));
    });
    
    it('should throw an error if refund creation fails', async () => {
      // Mock fetch for successful token but failed refund
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock_access_token' }),
        })
      );
      
      (fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'invalid_request', error_description: 'PayPal API error' }),
        })
      );
      
      const captureId = 'capture_123';
      
      await expect(service.createRefund(captureId)).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create PayPal refund'),
        expect.any(String),
      );
    });
  });
}); 