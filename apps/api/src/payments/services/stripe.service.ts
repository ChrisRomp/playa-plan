import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreateStripePaymentDto } from '../dto';

/**
 * Service for handling Stripe payment processing
 */
@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('payment.stripe.secretKey');
    
    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured. Stripe payment processing will be unavailable.');
    }
    
    this.stripe = new Stripe(secretKey || 'dummy_key_for_di', {
      apiVersion: '2023-10-16' as any,
    });
  }

  /**
   * Create a payment intent for a single payment
   * @param paymentData - The payment data
   * @returns The created payment intent
   */
  async createPaymentIntent(paymentData: CreateStripePaymentDto): Promise<Stripe.PaymentIntent> {
    try {
      this.logger.log(`Creating payment intent for user ${paymentData.userId} for amount ${paymentData.amount}`);
      
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: paymentData.amount, // Stripe uses cents
        currency: paymentData.currency || 'usd',
        description: paymentData.description || 'Payment for camp registration',
        metadata: {
          userId: paymentData.userId,
          registrationId: paymentData.registrationId || '',
        },
      });
      
      this.logger.log(`Created payment intent ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error: any) {
      this.logger.error(`Failed to create payment intent: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a checkout session for collecting payment
   * @param paymentData - The payment data
   * @returns The created checkout session
   */
  async createCheckoutSession(paymentData: CreateStripePaymentDto): Promise<Stripe.Checkout.Session> {
    try {
      this.logger.log(`Creating checkout session for user ${paymentData.userId} for amount ${paymentData.amount}`);
      
      const successUrl = paymentData.successUrl || 
        this.configService.get<string>('frontend.url') + '/payment/success?session_id={CHECKOUT_SESSION_ID}';
      
      const cancelUrl = paymentData.cancelUrl || 
        this.configService.get<string>('frontend.url') + '/payment/cancel';

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: paymentData.currency || 'usd',
              product_data: {
                name: paymentData.description || 'Camp Registration Fee',
              },
              unit_amount: paymentData.amount,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: paymentData.userId,
          registrationId: paymentData.registrationId || '',
        },
      });
      
      this.logger.log(`Created checkout session ${session.id}`);
      return session;
    } catch (error: any) {
      this.logger.error(`Failed to create checkout session: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process a refund for a payment
   * @param paymentIntentId - The payment intent ID to refund
   * @param amount - Optional amount to refund (in cents)
   * @param reason - Optional reason for the refund
   * @returns The created refund
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string,
  ): Promise<Stripe.Refund> {
    try {
      this.logger.log(`Creating refund for payment ${paymentIntentId}`);
      
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        reason: reason ? (reason as 'duplicate' | 'fraudulent' | 'requested_by_customer') : undefined,
      };
      
      if (amount) {
        refundParams.amount = amount;
      }
      
      const refund = await this.stripe.refunds.create(refundParams);
      
      this.logger.log(`Created refund ${refund.id} for payment ${paymentIntentId}`);
      return refund;
    } catch (error: any) {
      this.logger.error(`Failed to process refund: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Retrieve a payment intent by ID
   * @param paymentIntentId - The payment intent ID
   * @returns The payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      this.logger.error(`Failed to retrieve payment intent: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Verify and process a webhook event from Stripe
   * @param payload - The raw request payload
   * @param signature - The Stripe signature header
   * @returns The constructed event
   */
  async constructEventFromWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get<string>('payment.stripe.webhookSecret');
    
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }
    
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (error: any) {
      this.logger.error(`Failed to verify webhook: ${error.message}`, error.stack);
      throw error;
    }
  }
} 