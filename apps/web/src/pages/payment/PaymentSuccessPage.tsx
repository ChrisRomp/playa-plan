import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircleIcon } from 'lucide-react';
import { handleStripeSuccess } from '../../lib/stripe';

/**
 * PaymentSuccessPage component
 * Displays success message after payment completion and handles any cleanup
 */
const PaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setError('No payment session found');
      setIsProcessing(false);
      return;
    }

    // Handle the successful payment
    handleStripeSuccess(sessionId)
      .then(() => {
        setIsProcessing(false);
      })
      .catch((err) => {
        console.error('Error processing payment success:', err);
        setError('Error processing payment confirmation');
        setIsProcessing(false);
      });
  }, [searchParams]);

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleGoToRegistration = () => {
    navigate('/registration');
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-semibold text-red-800 mb-2">Payment Error</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={handleGoToDashboard}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="bg-green-50 border border-green-200 rounded-lg p-8">
          <CheckCircleIcon className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-green-800 mb-2">Payment Successful!</h1>
          <p className="text-green-600 mb-6">
            Your payment has been processed successfully. Your registration is now confirmed.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleGoToDashboard}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              View Dashboard
            </button>
            <button
              onClick={handleGoToRegistration}
              className="w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              View Registration Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage; 