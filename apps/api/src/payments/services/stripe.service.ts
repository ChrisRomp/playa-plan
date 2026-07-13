import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreateStripePaymentDto } from '../dto';
import { CoreConfigService } from '../../core-config/services/core-config.service';

export class StripeRefundError extends Error {
  constructor(message: string, readonly possiblySubmitted: boolean) {
    super(message);
    this.name = 'StripeRefundError';
  }
}

interface RefundMetadata {
  readonly refundId: string;
  readonly paymentId: string;
}

/**
 * Service for handling Stripe payment processing
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripeInstance: Stripe | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly coreConfigService: CoreConfigService,
  ) {}

  /**
   * Get or initialize the Stripe instance with current configuration
   */
  private async getStripe(): Promise<Stripe> {
    if (!this.stripeInstance) {
      const coreConfig = await this.coreConfigService.findCurrent();
      
      if (!coreConfig.stripeEnabled || !coreConfig.stripeApiKey) {
        throw new Error('Stripe payments are not configured');
      }
      
      this.stripeInstance = new Stripe(coreConfig.stripeApiKey, {
        apiVersion: '2023-10-16',
      });
    }
    
    return this.stripeInstance;
  }

  /**
   * Get the current core configuration for Stripe settings
   */
  private async getCoreConfig() {
    return await this.coreConfigService.findCurrent();
  }

  /**
   * Sanitize error messages to prevent API key leakage
   */
  private sanitizeErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object' || !('message' in error)) {
      return 'Unknown error occurred';
    }
    
    const message = (error as { message: string }).message;
    
    // Remove any potential API keys from error messages
    return message
      .replace(/sk_test_[a-zA-Z0-9]+/g, 'sk_test_***')
      .replace(/sk_live_[a-zA-Z0-9]+/g, 'sk_live_***')
      .replace(/pk_test_[a-zA-Z0-9]+/g, 'pk_test_***')
      .replace(/pk_live_[a-zA-Z0-9]+/g, 'pk_live_***')
      .replace(/whsec_[a-zA-Z0-9]+/g, 'whsec_***');
  }

  private isAmbiguousRefundSubmissionError(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('type' in error)) {
      return false;
    }

    const stripeErrorType = String((error as { type?: unknown }).type ?? '');
    return stripeErrorType === 'StripeConnectionError' || stripeErrorType === 'StripeAPIError';
  }

  private async resolvePaymentIntentId(providerRefId: string): Promise<string> {
    if (!providerRefId.startsWith('cs_')) {
      return providerRefId;
    }

    this.logger.log(`Converting checkout session ${providerRefId} to payment intent ID`);
    const session = await this.getCheckoutSession(providerRefId);

    if (!session.payment_intent) {
      throw new Error(`Checkout session ${providerRefId} has no associated payment intent`);
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent.id;
    this.logger.log(`Found payment intent ${paymentIntentId} for session ${providerRefId}`);
    return paymentIntentId;
  }

  /**
   * Create a payment intent for a single payment
   * @param paymentData - The payment data
   * @returns The created payment intent
   */
  async createPaymentIntent(paymentData: CreateStripePaymentDto): Promise<Stripe.PaymentIntent> {
    try {
      this.logger.log(`Creating payment intent for user ${paymentData.userId} for amount ${paymentData.amount}`);
      
      const stripe = await this.getStripe();
      
      const paymentIntent = await stripe.paymentIntents.create({
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
    } catch (error: unknown) {
      const sanitizedMessage = this.sanitizeErrorMessage(error);
      this.logger.error(`Failed to create payment intent: ${sanitizedMessage}`);
      throw new Error(sanitizedMessage);
    }
  }

  /**
   * Create a checkout session for collecting payment
   * @param paymentData - The payment data
   * @returns The created checkout session
   */
  async createCheckoutSession(paymentData: CreateStripePaymentDto): Promise<Stripe.Checkout.Session> {
    try {
      this.logger.log(`Creating checkout session for user ${paymentData.userId} for amount ${paymentData.amount}, registrationId: ${paymentData.registrationId || 'none'}`);
      
      const stripe = await this.getStripe();
      
      const successUrl = paymentData.successUrl || 
        this.configService.get<string>('frontend.url') + '/payment/success.html?session_id={CHECKOUT_SESSION_ID}';
      
      const cancelUrl = paymentData.cancelUrl || 
        this.configService.get<string>('frontend.url') + '/payment/cancel.html';

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
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
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      
      this.logger.log(`Created checkout session ${session.id} with metadata:`, {
        userId: sessionParams.metadata?.userId,
        registrationId: sessionParams.metadata?.registrationId
      });
      return session;
    } catch (error: unknown) {
      const sanitizedMessage = this.sanitizeErrorMessage(error);
      this.logger.error(`Failed to create checkout session: ${sanitizedMessage}`);
      throw new Error(sanitizedMessage);
    }
  }

  /**
   * Process a refund for a payment
   * @param providerRefId - The payment intent ID or checkout session ID to refund
   * @param amount - Optional amount to refund (in cents)
   * @param reason - Optional reason for the refund
   * @returns The created refund
   */
  async createRefund(
    providerRefId: string,
    amount?: number,
    reason?: string,
    idempotencyKey?: string,
    metadata?: RefundMetadata,
  ): Promise<Stripe.Refund> {
    let refundRequestAttempted = false;

    try {
      this.logger.log(`Creating refund for payment ${providerRefId}`);
      
      const stripe = await this.getStripe();
      const paymentIntentId = await this.resolvePaymentIntentId(providerRefId);
      
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };
      
      if (amount) {
        refundParams.amount = amount;
      }
      
      // Map custom reasons to valid Stripe reasons or omit if not applicable
      if (reason) {
        const lowerReason = reason.toLowerCase();
        if (lowerReason.includes('duplicate')) {
          refundParams.reason = 'duplicate';
        } else if (lowerReason.includes('fraud')) {
          refundParams.reason = 'fraudulent';
        } else {
          // For registration cancellations and other customer requests, use requested_by_customer
          refundParams.reason = 'requested_by_customer';
        }
      }

      if (metadata) {
        refundParams.metadata = {
          playaPlanRefundId: metadata.refundId,
          playaPlanPaymentId: metadata.paymentId,
        };
      }
      
      refundRequestAttempted = true;
      const refund = idempotencyKey
        ? await stripe.refunds.create(refundParams, { idempotencyKey })
        : await stripe.refunds.create(refundParams);
      
      this.logger.log(`Created refund ${refund.id} for payment intent ${paymentIntentId}`);
      return refund;
    } catch (error: unknown) {
      const sanitizedMessage = this.sanitizeErrorMessage(error);
      this.logger.error(`Failed to process refund: ${sanitizedMessage}`);
      const possiblySubmitted = refundRequestAttempted && this.isAmbiguousRefundSubmissionError(error);
      throw new StripeRefundError(
        sanitizedMessage,
        possiblySubmitted,
      );
    }
  }

  async findRefundByMetadata(providerRefId: string, refundId: string): Promise<Stripe.Refund | null> {
    try {
      const stripe = await this.getStripe();
      const paymentIntentId = await this.resolvePaymentIntentId(providerRefId);
      let startingAfter: string | undefined;

      while (true) {
        const refunds = await stripe.refunds.list({
          payment_intent: paymentIntentId,
          limit: 100,
          ...(startingAfter && { starting_after: startingAfter }),
        });
        const matchingRefund = refunds.data.find(
          (refund) => refund.metadata?.playaPlanRefundId === refundId,
        );

        if (matchingRefund) {
          return matchingRefund;
        }
        if (!refunds.has_more || refunds.data.length === 0) {
          return null;
        }

        startingAfter = refunds.data[refunds.data.length - 1].id;
      }
    } catch (error: unknown) {
      const sanitizedMessage = this.sanitizeErrorMessage(error);
      this.logger.error(`Failed to find refund by metadata: ${sanitizedMessage}`);
      throw new Error(sanitizedMessage);
    }
  }

  async retrieveRefund(refundId: string): Promise<Stripe.Refund> {
    try {
      const stripe = await this.getStripe();
      return await stripe.refunds.retrieve(refundId);
    } catch (error: unknown) {
      const sanitizedMessage = this.sanitizeErrorMessage(error);
      this.logger.error(`Failed to retrieve refund: ${sanitizedMessage}`);
      throw new Error(sanitizedMessage);
    }
  }

  /**
   * Retrieve a payment intent by ID
   * @param paymentIntentId - The payment intent ID
   * @returns The payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = await this.getStripe();
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: unknown) {
      const sanitizedMessage = this.sanitizeErrorMessage(error);
      this.logger.error(`Failed to retrieve payment intent: ${sanitizedMessage}`);
      throw new Error(sanitizedMessage);
    }
  }

  /**
   * Retrieve a checkout session by ID
   * @param sessionId - The checkout session ID
   * @returns The checkout session
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      const stripe = await this.getStripe();
      return await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent']
      });
    } catch (error: unknown) {
      const sanitizedMessage = this.sanitizeErrorMessage(error);
      this.logger.error(`Failed to retrieve checkout session: ${sanitizedMessage}`);
      throw new Error(sanitizedMessage);
    }
  }
} 