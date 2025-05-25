import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircleIcon } from 'lucide-react';
import { handleStripeCancel } from '../../lib/stripe';

/**
 * PaymentCancelPage component
 * Displays when user cancels payment or payment fails
 */
const PaymentCancelPage: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    // Handle the payment cancellation
    handleStripeCancel();
  }, []);

  const handleRetryPayment = () => {
    navigate('/registration');
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-8">
          <XCircleIcon className="w-16 h-16 text-orange-600 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-orange-800 mb-2">Payment Cancelled</h1>
          <p className="text-orange-600 mb-6">
            Your payment was cancelled. Don't worry - no charges were made to your account.
            You can try again when you're ready.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleRetryPayment}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Try Payment Again
            </button>
            <button
              onClick={handleGoToDashboard}
              className="w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancelPage; 