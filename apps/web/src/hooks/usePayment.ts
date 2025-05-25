import { useState, useContext } from 'react';
import { redirectToStripeCheckout } from '../lib/stripe';
import { useConfig } from '../store/ConfigContext';
import { AuthContext } from '../store/authUtils';
import { StripePaymentRequest } from '../types';

export interface PaymentOptions {
  amount: number; // Amount in dollars
  registrationId?: string;
  description?: string;
}

export const usePayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { config } = useConfig();
  const { user } = useContext(AuthContext);

  /**
   * Process a payment via Stripe
   */
  const processStripePayment = async (options: PaymentOptions): Promise<void> => {
    setIsProcessing(true);
    setError(null);

    try {
      if (!user) {
        throw new Error('User must be logged in to make payment');
      }

      if (!config?.stripeEnabled || !config?.stripePublicKey) {
        throw new Error('Stripe payments are not configured');
      }

      const paymentRequest: StripePaymentRequest = {
        amount: Math.round(options.amount * 100), // Convert to cents
        currency: 'USD',
        userId: user.id,
        registrationId: options.registrationId,
        description: options.description || 'Camp registration payment',
        successUrl: `${window.location.origin}/payment/success`,
        cancelUrl: `${window.location.origin}/payment/cancel`,
      };

      await redirectToStripeCheckout(config.stripePublicKey, paymentRequest);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Process a payment via PayPal (placeholder for future implementation)
   */
  const processPayPalPayment = async (options: PaymentOptions): Promise<void> => {
    setIsProcessing(true);
    setError(null);

    try {
      if (!config?.paypalEnabled) {
        throw new Error('PayPal payments are not configured');
      }
      
      // Log the options for debugging when we implement PayPal
      console.log('PayPal payment options:', options);
      
      throw new Error('PayPal payments not yet implemented');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Check if payments are available
   */
  const isPaymentAvailable = (): boolean => {
    return !!(config?.stripeEnabled && config?.stripePublicKey) || 
           !!(config?.paypalEnabled && config?.paypalClientId);
  };

  /**
   * Check if Stripe is available
   */
  const isStripeAvailable = (): boolean => {
    return !!(config?.stripeEnabled && config?.stripePublicKey);
  };

  /**
   * Check if PayPal is available
   */
  const isPayPalAvailable = (): boolean => {
    return !!(config?.paypalEnabled && config?.paypalClientId);
  };

  return {
    isProcessing,
    error,
    processStripePayment,
    processPayPalPayment,
    isPaymentAvailable,
    isStripeAvailable,
    isPayPalAvailable,
    clearError: () => setError(null),
  };
}; 