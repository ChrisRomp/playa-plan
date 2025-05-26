import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircleIcon, AlertCircleIcon } from 'lucide-react';
import { handleStripeSuccess } from '../../lib/stripe';

interface PaymentVerificationResult {
  paymentStatus: string;
  registrationId?: string;
  registrationStatus?: string;
  paymentId?: string;
}

/**
 * PaymentSuccessPage component
 * Displays success message after payment completion and handles any cleanup
 */
const PaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<PaymentVerificationResult | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setError('No payment session found');
      setIsProcessing(false);
      return;
    }

    // Handle the successful payment
    handleStripeSuccess(sessionId)
      .then((result) => {
        setVerificationResult(result);
        setIsProcessing(false);
      })
      .catch((err) => {
        console.error('Error processing payment success:', err);
        
        // Check if it's an authentication error
        if (err?.response?.status === 401) {
          setError('Your session has expired. Please log in again to view your payment status.');
        } else if (err?.response?.status === 404) {
          setError('Payment session not found. Please contact support if you believe this is an error.');
        } else {
          setError('Error processing payment confirmation. Please try refreshing the page.');
        }
        setIsProcessing(false);
      });
  }, [searchParams]);

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleGoToRegistration = () => {
    if (verificationResult?.registrationId) {
      navigate(`/registration/${verificationResult.registrationId}`);
    } else {
      navigate('/registration');
    }
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
    const isAuthError = error.includes('session has expired');
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <AlertCircleIcon className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-red-800 mb-2">Payment Error</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="space-y-3">
              {isAuthError ? (
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Login
                </button>
              ) : (
                <button
                  onClick={handleGoToDashboard}
                  className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Dashboard
                </button>
              )}
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPaymentCompleted = verificationResult?.paymentStatus === 'COMPLETED';
  const isRegistrationConfirmed = verificationResult?.registrationStatus === 'CONFIRMED';

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className={`border rounded-lg p-8 ${
          isPaymentCompleted ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          {isPaymentCompleted ? (
            <CheckCircleIcon className="w-16 h-16 text-green-600 mx-auto mb-4" />
          ) : (
            <AlertCircleIcon className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
          )}
          
          <h1 className={`text-2xl font-semibold mb-2 ${
            isPaymentCompleted ? 'text-green-800' : 'text-yellow-800'
          }`}>
            {isPaymentCompleted ? 'Payment Successful!' : 'Payment Processing'}
          </h1>
          
          <div className={`mb-6 ${
            isPaymentCompleted ? 'text-green-600' : 'text-yellow-600'
          }`}>
            {isPaymentCompleted ? (
              <div>
                <p className="mb-2">Your payment has been processed successfully.</p>
                {isRegistrationConfirmed ? (
                  <p className="font-medium">Your registration is now confirmed!</p>
                ) : (
                  <p>Your registration is being processed and will be confirmed shortly.</p>
                )}
              </div>
            ) : (
              <div>
                <p className="mb-2">Your payment is being processed.</p>
                <p>Current status: {verificationResult?.paymentStatus}</p>
                {verificationResult?.registrationStatus && (
                  <p>Registration status: {verificationResult.registrationStatus}</p>
                )}
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleGoToDashboard}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              View Dashboard
            </button>
            {verificationResult?.registrationId && (
              <button
                onClick={handleGoToRegistration}
                className="w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                View Registration Details
              </button>
            )}
          </div>
          
          {/* Debug info for development */}
          {process.env.NODE_ENV === 'development' && verificationResult && (
            <div className="mt-6 p-3 bg-gray-100 rounded text-xs text-left">
              <p><strong>Debug Info:</strong></p>
              <p>Payment ID: {verificationResult.paymentId}</p>
              <p>Payment Status: {verificationResult.paymentStatus}</p>
              <p>Registration ID: {verificationResult.registrationId}</p>
              <p>Registration Status: {verificationResult.registrationStatus}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage; 