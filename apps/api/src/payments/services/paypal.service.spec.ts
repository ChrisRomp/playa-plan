import { Test, TestingModule } from '@nestjs/testing';
import { PaypalService } from './paypal.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaypalService', () => {
  let service: PaypalService;
  let configService: ConfigService;

  beforeEach(async () => {
    // Mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockImplementation((key) => {
        const config = {
          'paypal.clientId': 'mock_paypal_client_id',
          'paypal.clientSecret': 'mock_paypal_client_secret',
          'paypal.mode': 'sandbox',
        };
        return config[key];
      }),
    };

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
    configService = module.get<ConfigService>(ConfigService);
    
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

  describe('getAccessToken', () => {
    it('should get an access token successfully', async () => {
      // Mock data
      const mockAccessTokenResponse = {
        data: {
          access_token: 'mock_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      // Setup mocks
      mockedAxios.post.mockResolvedValueOnce(mockAccessTokenResponse);

      // Execute
      const result = await service.getAccessToken();

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/oauth2/token'),
        'grant_type=client_credentials',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          auth: {
            username: 'mock_paypal_client_id',
            password: 'mock_paypal_client_secret',
          },
        })
      );
      expect(result).toEqual(mockAccessTokenResponse.data.access_token);
    });

    it('should handle errors when getting access token', async () => {
      // Mock data
      const mockError = new Error('PayPal API Error');

      // Setup mocks
      mockedAxios.post.mockRejectedValueOnce(mockError);

      // Execute & Assert
      await expect(service.getAccessToken()).rejects.toThrow();
    });
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      // Mock data
      const mockPaymentData = {
        amount: 100,
        currency: 'USD',
        userId: 'user-123',
        itemDescription: 'Test payment',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };
      
      const mockAccessTokenResponse = {
        data: {
          access_token: 'mock_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };
      
      const mockOrderResponse = {
        data: {
          id: 'order-123',
          status: 'CREATED',
          links: [
            {
              href: 'https://www.sandbox.paypal.com/checkoutnow/order-123',
              rel: 'approve',
              method: 'GET',
            },
          ],
        },
      };

      // Setup mocks
      mockedAxios.post.mockResolvedValueOnce(mockAccessTokenResponse); // getAccessToken
      mockedAxios.post.mockResolvedValueOnce(mockOrderResponse); // createOrder

      // Execute
      const result = await service.createOrder(mockPaymentData);

      // Assert first API call (getAccessToken)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/oauth2/token'),
        expect.any(String),
        expect.any(Object)
      );
      
      // Assert second API call (createOrder)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v2/checkout/orders'),
        expect.objectContaining({
          intent: 'CAPTURE',
          purchase_units: expect.arrayContaining([
            expect.objectContaining({
              amount: expect.objectContaining({
                value: '100.00',
                currency_code: 'USD',
              }),
              description: mockPaymentData.itemDescription,
            }),
          ]),
          application_context: expect.objectContaining({
            return_url: mockPaymentData.successUrl,
            cancel_url: mockPaymentData.cancelUrl,
          }),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessTokenResponse.data.access_token}`,
          }),
        })
      );
      
      expect(result).toEqual(mockOrderResponse.data);
    });

    it('should handle errors when creating order', async () => {
      // Mock data
      const mockPaymentData = {
        amount: 100,
        currency: 'USD',
        userId: 'user-123',
        itemDescription: 'Test payment',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };
      
      const mockAccessTokenResponse = {
        data: {
          access_token: 'mock_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };
      
      const mockError = new Error('PayPal API Error');

      // Setup mocks
      mockedAxios.post.mockResolvedValueOnce(mockAccessTokenResponse); // getAccessToken
      mockedAxios.post.mockRejectedValueOnce(mockError); // createOrder

      // Execute & Assert
      await expect(service.createOrder(mockPaymentData)).rejects.toThrow();
    });
  });

  describe('capturePayment', () => {
    it('should capture a payment successfully', async () => {
      // Mock data
      const orderId = 'order-123';
      
      const mockAccessTokenResponse = {
        data: {
          access_token: 'mock_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };
      
      const mockCaptureResponse = {
        data: {
          id: orderId,
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'capture-123',
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
        },
      };

      // Setup mocks
      mockedAxios.post.mockResolvedValueOnce(mockAccessTokenResponse); // getAccessToken
      mockedAxios.post.mockResolvedValueOnce(mockCaptureResponse); // capturePayment

      // Execute
      const result = await service.capturePayment(orderId);

      // Assert first API call (getAccessToken)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/oauth2/token'),
        expect.any(String),
        expect.any(Object)
      );
      
      // Assert second API call (capturePayment)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/v2/checkout/orders/${orderId}/capture`),
        {},
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessTokenResponse.data.access_token}`,
          }),
        })
      );
      
      expect(result).toEqual(mockCaptureResponse.data);
    });

    it('should handle errors when capturing payment', async () => {
      // Mock data
      const orderId = 'order-123';
      
      const mockAccessTokenResponse = {
        data: {
          access_token: 'mock_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };
      
      const mockError = new Error('PayPal API Error');

      // Setup mocks
      mockedAxios.post.mockResolvedValueOnce(mockAccessTokenResponse); // getAccessToken
      mockedAxios.post.mockRejectedValueOnce(mockError); // capturePayment

      // Execute & Assert
      await expect(service.capturePayment(orderId)).rejects.toThrow();
    });
  });

  describe('getOrderDetails', () => {
    it('should get order details successfully', async () => {
      // Mock data
      const orderId = 'order-123';
      
      const mockAccessTokenResponse = {
        data: {
          access_token: 'mock_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };
      
      const mockOrderDetailsResponse = {
        data: {
          id: orderId,
          status: 'COMPLETED',
          purchase_units: [
            {
              amount: {
                value: '100.00',
                currency_code: 'USD',
              },
            },
          ],
        },
      };

      // Setup mocks
      mockedAxios.post.mockResolvedValueOnce(mockAccessTokenResponse); // getAccessToken
      mockedAxios.get.mockResolvedValueOnce(mockOrderDetailsResponse); // getOrderDetails

      // Execute
      const result = await service.getOrderDetails(orderId);

      // Assert first API call (getAccessToken)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/oauth2/token'),
        expect.any(String),
        expect.any(Object)
      );
      
      // Assert second API call (getOrderDetails)
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/v2/checkout/orders/${orderId}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessTokenResponse.data.access_token}`,
          }),
        })
      );
      
      expect(result).toEqual(mockOrderDetailsResponse.data);
    });

    it('should handle errors when getting order details', async () => {
      // Mock data
      const orderId = 'order-123';
      
      const mockAccessTokenResponse = {
        data: {
          access_token: 'mock_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };
      
      const mockError = new Error('PayPal API Error');

      // Setup mocks
      mockedAxios.post.mockResolvedValueOnce(mockAccessTokenResponse); // getAccessToken
      mockedAxios.get.mockRejectedValueOnce(mockError); // getOrderDetails

      // Execute & Assert
      await expect(service.getOrderDetails(orderId)).rejects.toThrow();
    });
  });

  describe('createRefund', () => {
    it('should create a refund successfully', async () => {
      // Mock data
      const captureId = 'capture-123';
      const amount = 100;
      const note = 'Refund for order';
      
      const mockAccessTokenResponse = {
        data: {
          access_token: 'mock_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };
      
      const mockRefundResponse = {
        data: {
          id: 'refund-123',
          status: 'COMPLETED',
          amount: {
            value: '100.00',
            currency_code: 'USD',
          },
          note_to_payer: note,
        },
      };

      // Setup mocks
      mockedAxios.post.mockResolvedValueOnce(mockAccessTokenResponse); // getAccessToken
      mockedAxios.post.mockResolvedValueOnce(mockRefundResponse); // createRefund

      // Execute
      const result = await service.createRefund(captureId, amount, note);

      // Assert first API call (getAccessToken)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/oauth2/token'),
        expect.any(String),
        expect.any(Object)
      );
      
      // Assert second API call (createRefund)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/v2/payments/captures/${captureId}/refund`),
        expect.objectContaining({
          amount: expect.objectContaining({
            value: '100.00',
            currency_code: 'USD',
          }),
          note_to_payer: note,
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessTokenResponse.data.access_token}`,
          }),
        })
      );
      
      expect(result).toEqual(mockRefundResponse.data);
    });

    it('should handle errors when creating refund', async () => {
      // Mock data
      const captureId = 'capture-123';
      const amount = 100;
      const note = 'Refund for order';
      
      const mockAccessTokenResponse = {
        data: {
          access_token: 'mock_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };
      
      const mockError = new Error('PayPal API Error');

      // Setup mocks
      mockedAxios.post.mockResolvedValueOnce(mockAccessTokenResponse); // getAccessToken
      mockedAxios.post.mockRejectedValueOnce(mockError); // createRefund

      // Execute & Assert
      await expect(service.createRefund(captureId, amount, note)).rejects.toThrow();
    });
  });
}); 