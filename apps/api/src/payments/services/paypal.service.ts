import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatePaypalPaymentDto } from '../dto';

interface PayPalRefundData {
  amount?: {
    value: string;
    currency_code: string;
  };
  note_to_payer?: string;
}

interface PayPalRefundResponse {
  id: string;
  status: string;
  amount?: {
    currency_code: string;
    value: string;
  };
}

interface PayPalOrderDetails {
  id: string;
  status: string;
  intent: string;
  purchase_units: PayPalPurchaseUnit[];
  create_time: string;
  update_time: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

/**
 * PayPal API response types
 */
interface PayPalErrorResponse {
  error: string;
  error_description: string;
}

interface PayPalTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

interface PayPalPaymentSource {
  paypal?: {
    account_id?: string;
    account_status?: string;
    email_address?: string;
    phone_number?: {
      country_code?: string;
      national_number?: string;
    };
    name?: {
      given_name?: string;
      surname?: string;
    };
  };
}

interface PayPalPurchaseUnit {
  reference_id?: string;
  amount: {
    currency_code: string;
    value: string;
  };
  payee?: {
    email_address?: string;
    merchant_id?: string;
  };
  payments?: {
    captures?: Array<{
      id: string;
      status: string;
      amount: {
        currency_code: string;
        value: string;
      };
    }>;
  };
}

interface PayPalCaptureResponse {
  id: string;
  status: string;
  payment_source: PayPalPaymentSource;
  purchase_units: PayPalPurchaseUnit[];
}

/**
 * Service for handling PayPal payment processing
 */
@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly mode: 'sandbox' | 'live';
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('payment.paypal.clientId') || '';
    this.clientSecret = this.configService.get<string>('payment.paypal.clientSecret') || '';
    this.mode = this.configService.get<'sandbox' | 'live'>('payment.paypal.mode') || 'sandbox';
    this.baseUrl = this.mode === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';
    
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('PayPal credentials not configured. PayPal payment processing will be unavailable.');
    }
  }

  /**
   * Get an access token for PayPal API
   * @returns Access token
   */
  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
        body: 'grant_type=client_credentials',
      });
      
      if (!response.ok) {
        const errorData = await response.json() as PayPalErrorResponse;
        throw new Error(`PayPal access token error: ${errorData.error_description}`);
      }
      
      const data = await response.json() as PayPalTokenResponse;
      return data.access_token;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get PayPal access token: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Create a PayPal order
   * @param paymentData - The payment data
   * @returns Order details including approval URL
   */
  async createOrder(paymentData: CreatePaypalPaymentDto): Promise<PayPalOrderResponse> {
    try {
      this.logger.log(`Creating PayPal order for user ${paymentData.userId} for amount ${paymentData.amount}`);
      
      const accessToken = await this.getAccessToken();
      
      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: paymentData.currency?.toUpperCase() || 'USD',
              value: paymentData.amount.toString(),
            },
            description: paymentData.itemDescription,
            custom_id: `userid:${paymentData.userId}${paymentData.registrationId ? `;registrationid:${paymentData.registrationId}` : ''}`,
          },
        ],
        application_context: {
          brand_name: 'PlayaPlan',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: paymentData.successUrl,
          cancel_url: paymentData.cancelUrl,
        },
      };
      
      const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`PayPal order creation error: ${JSON.stringify(errorData)}`);
      }
      
      const order = await response.json() as PayPalOrderResponse;
      this.logger.log(`Created PayPal order ${order.id}`);
      
      return order;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create PayPal order: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Capture a payment for an approved PayPal order
   * @param orderId - The PayPal order ID
   * @returns Capture details
   */
  async capturePayment(orderId: string): Promise<PayPalCaptureResponse> {
    try {
      this.logger.log(`Capturing payment for PayPal order ${orderId}`);
      
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`PayPal payment capture error: ${JSON.stringify(errorData)}`);
      }
      
      const captureData = await response.json() as PayPalCaptureResponse;
      this.logger.log(`Captured payment for order ${orderId}, status: ${captureData.status}`);
      
      return captureData;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to capture PayPal payment: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get PayPal order details
   * @param orderId - The PayPal order ID
   * @returns Order details
   */
  async getOrderDetails(orderId: string): Promise<PayPalOrderDetails> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`PayPal order details error: ${JSON.stringify(errorData)}`);
      }
      
      return response.json() as Promise<PayPalOrderDetails>;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get PayPal order details: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Create a refund for a PayPal payment
   * @param captureId - The PayPal capture ID
   * @param amount - Optional amount to refund
   * @param note - Optional note about the refund
   * @returns Refund details
   */
  async createRefund(captureId: string, amount?: number, note?: string): Promise<PayPalRefundResponse> {
    try {
      this.logger.log(`Creating refund for PayPal capture ${captureId}`);
      
      const accessToken = await this.getAccessToken();
      
      const refundData: PayPalRefundData = {};
      
      if (amount) {
        refundData.amount = {
          value: amount.toString(),
          currency_code: 'USD',
        };
      }
      
      if (note) {
        refundData.note_to_payer = note;
      }
      
      const response = await fetch(`${this.baseUrl}/v2/payments/captures/${captureId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: Object.keys(refundData).length ? JSON.stringify(refundData) : undefined,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`PayPal refund error: ${JSON.stringify(errorData)}`);
      }
      
      const refundDetails = await response.json() as PayPalRefundResponse;
      this.logger.log(`Created refund for capture ${captureId}, status: ${refundDetails.status}`);
      
      return refundDetails;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to process PayPal refund: ${errorMessage}`, errorStack);
      throw error;
    }
  }
} 