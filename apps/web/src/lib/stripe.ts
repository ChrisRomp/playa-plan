import { loadStripe, Stripe } from '@stripe/stripe-js';
import { api } from './api';
import { StripePaymentRequest, StripePaymentResponse } from '../types';

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Initialize Stripe with the public key from config
 */
export const getStripe = async (publicKey: string): Promise<Stripe | null> => {
  if (!stripePromise) {
    stripePromise = loadStripe(publicKey);
  }
  return stripePromise;
};

/**
 * Create a payment session with Stripe
 * CRITICAL: paymentData.registrationId must be included to associate payment with registration
 */
export const createStripePayment = async (
  paymentData: StripePaymentRequest
): Promise<StripePaymentResponse> => {
  try {
    // CRITICAL: This API call sends registrationId to backend for payment-registration linking
    const response = await api.post('/payments/stripe', paymentData);
    return response.data;
  } catch (error) {
    console.error('Failed to create Stripe payment:', error);
    throw error;
  }
};

/**
 * Redirect to Stripe checkout
 */
export const redirectToStripeCheckout = async (
  stripePublicKey: string,
  paymentData: StripePaymentRequest
): Promise<void> => {
  const stripe = await getStripe(stripePublicKey);
  
  if (!stripe) {
    throw new Error('Failed to load Stripe');
  }

  // Create payment session
  const { url } = await createStripePayment(paymentData);
  
  if (!url) {
    throw new Error('No checkout URL returned from payment service');
  }

  // Redirect to Stripe checkout
  window.location.href = url;
};

/**
 * Handle successful payment return from Stripe
 */
export const handleStripeSuccess = async (sessionId: string): Promise<{
  paymentStatus: string;
  registrationId?: string;
  registrationStatus?: string;
  paymentId?: string;
}> => {
  try {
    console.log('Verifying payment session:', sessionId);
    
    const response = await api.get(`/payments/stripe/session/${sessionId}/verify`);
    const result = response.data;
    
    return {
      paymentStatus: result.paymentStatus,
      registrationId: result.registrationId,
      registrationStatus: result.registrationStatus,
      paymentId: result.paymentId,
    };
  } catch (error) {
    console.error('Failed to verify payment session:', error);
    throw new Error('Failed to verify payment session');
  }
};

/**
 * Handle cancelled payment from Stripe
 */
export const handleStripeCancel = (): void => {
  console.log('Payment was cancelled by user');
}; 