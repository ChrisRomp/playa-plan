import { CreditCardIcon, Loader2Icon } from 'lucide-react';
import { usePayment, PaymentOptions } from '../../hooks/usePayment';

interface PaymentButtonProps {
  amount: number;
  registrationId?: string;
  description?: string;
  onPaymentStart?: () => void | Promise<void | { registrationId?: string }>;
  onPaymentError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * PaymentButton component
 * Handles payment processing with Stripe integration
 */
const PaymentButton: React.FC<PaymentButtonProps> = ({
  amount,
  registrationId,
  description,
  onPaymentStart,
  onPaymentError,
  disabled = false,
  className = '',
  children,
}) => {
  const {
    isProcessing,
    error,
    processStripePayment,
    isStripeAvailable,
    clearError,
  } = usePayment();

  const handlePaymentClick = async () => {
    if (!isStripeAvailable()) {
      const errorMsg = 'Payment processing is not available';
      onPaymentError?.(errorMsg);
      return;
    }

    clearError();
    
    let actualRegistrationId = registrationId;
    
    try {
      // Call onPaymentStart and wait if it's async
      const result = await onPaymentStart?.();
      // If onPaymentStart returns an object with registrationId, use it
      if (result && typeof result === 'object' && 'registrationId' in result) {
        actualRegistrationId = result.registrationId || registrationId;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to prepare payment';
      onPaymentError?.(errorMessage);
      return;
    }

    const paymentOptions: PaymentOptions = {
      amount,
      // Use the actual registration ID from onPaymentStart result, otherwise use the prop
      registrationId: actualRegistrationId,
      description,
    };
    
    try {
      await processStripePayment(paymentOptions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      onPaymentError?.(errorMessage);
    }
  };

  const isDisabled = disabled || isProcessing || !isStripeAvailable();

  return (
    <div className="space-y-2">
      <button
        onClick={handlePaymentClick}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm
          text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors
          ${className}
        `}
      >
        {isProcessing ? (
          <Loader2Icon className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <CreditCardIcon className="w-5 h-5 mr-2" />
        )}
        
        {children || (
          <>
            {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
          </>
        )}
      </button>

      {error && (
        <div className="text-red-600 text-sm mt-2">
          {error}
        </div>
      )}

      {!isStripeAvailable() && (
        <div className="text-orange-600 text-sm mt-2">
          Payment processing is not currently available. Please contact camp administrators.
        </div>
      )}
    </div>
  );
};

export default PaymentButton; 