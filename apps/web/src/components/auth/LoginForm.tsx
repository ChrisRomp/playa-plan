import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/authUtils';

const LoginForm: React.FC = () => {
  // Form state
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  // Track whether verification code has been sent
  // Initialize from localStorage to maintain state across page refreshes
  const [codeSent, setCodeSent] = useState(() => {
    const savedEmail = localStorage.getItem('pendingLoginEmail');
    return savedEmail ? true : false;
  });
  
  // Use local loading state instead of the one from AuthContext
  const [localLoading, setLocalLoading] = useState(false);
  
  // Get authentication context values
  const { requestVerificationCode, verifyCode, error: authError } = useAuth();
  const [error, setError] = useState('');
  
  // Initialize email from localStorage if available (for page refreshes)
  useEffect(() => {
    // Always reset loading state on component mount
    setLocalLoading(false);
    
    const savedEmail = localStorage.getItem('pendingLoginEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setCodeSent(true);
    }
    
    // Clear any stuck loading state on page load
    // If the user manually refreshes during login, we may want to start fresh
    if (!savedEmail) {
      localStorage.removeItem('pendingLoginEmail');
    }
  }, []);

  // Update local error state when auth context error changes
  useEffect(() => {
    console.log('useEffect authError changed:', authError);
    if (authError) {
      setError(authError);
      // Reset loading state when there's an error from auth context
      console.log('useEffect: Setting localLoading to false due to authError');
      setLocalLoading(false);
    } else {
      // Clear local error when auth context error is cleared
      setError('');
    }
  }, [authError]);

  // Note: Redirect logic is now handled by the parent LoginPage component
  // We no longer need to handle redirects here as LoginPage uses React Router's useNavigate

  /**
   * Handle sending verification code to the provided email
   */
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    // Set local loading state
    setLocalLoading(true);
    
    try {
      console.log(`Attempting to send verification code to: ${email}`);
      
      // Call the API to send verification code
      const success = await requestVerificationCode(email);
      console.log(`Verification code request result: ${success ? 'success' : 'failed'}`);
      
      // Only proceed to verification code screen if code was sent successfully
      if (success) {
        // Save email to localStorage to maintain state across page refreshes
        localStorage.setItem('pendingLoginEmail', email);
        setCodeSent(true);
      } else {
        // Explicitly set error if the API call failed
        setError('Failed to send verification code. Please try again later.');
      }
    } catch (error) {
      // Set a specific error message
      setError('Network error when requesting verification code. Please check your connection and try again.');
      console.error('Failed to send verification code:', error);
    } finally {
      // Always reset loading state
      setLocalLoading(false);
    }
  };

  /**
   * Handle verification of the code for login/signup
   */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!verificationCode) {
      setError('Verification code is required');
      return;
    }
    
    console.log('handleVerify: Setting localLoading to true');
    // Set local loading state
    setLocalLoading(true);
    
    try {
      console.log('handleVerify: Calling verifyCode');
      // Call the API to verify the code
      await verifyCode(email, verificationCode);
      console.log('handleVerify: verifyCode succeeded');
      // Successful verification will trigger a redirect via the isAuthenticated useEffect
    } catch (err) {
      console.log('handleVerify: verifyCode failed, setting error and resetting loading');
      // If there's an error, display it to the user
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Verification failed. Please check your code and try again.');
      }
      console.error('Verification failed:', err);
      
      // Explicitly reset loading state on error
      setLocalLoading(false);
    } finally {
      console.log('handleVerify: Finally block - setting localLoading to false');
      // Always reset loading state regardless of success or failure
      setLocalLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">
        Log In or Sign Up
      </h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {!codeSent ? (
        <form onSubmit={handleSendCode}>
          <div className="mb-6">
            <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="your@email.com"
              required
              autoFocus
            />
          </div>
          
          <button
            type="submit"
            disabled={localLoading}
            className="w-full bg-amber-600 text-white font-medium py-2 px-4 rounded-md hover:bg-amber-700 transition-colors duration-300 disabled:bg-amber-400"
          >
            {localLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </span>
            ) : `Send Verification Code`}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify}>
          <div className="mb-2">
            <div className="text-gray-700 text-sm mb-4">
              A verification code has been sent to <span className="font-medium">{email}</span>.
              <button 
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  localStorage.removeItem('pendingLoginEmail');
                }}
                className="text-amber-600 hover:text-amber-800 ml-2 text-sm font-medium transition-colors"
              >
                Change
              </button>
            </div>
            <label htmlFor="verificationCode" className="block text-gray-700 text-sm font-medium mb-2">
              Verification Code
            </label>
            <input
              id="verificationCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]*"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Enter the code sent to your email"
              required
              autoFocus
            />
          </div>
          
          <button
            type="submit"
            disabled={localLoading}
            className="w-full bg-amber-600 text-white font-medium py-2 px-4 rounded-md hover:bg-amber-700 transition-colors duration-300 disabled:bg-amber-400 mt-4"
          >
            {localLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </span>
            ) : 'Log In'}
          </button>
        </form>
      )}
      
      <div className="mt-6 text-center">
        <p className="text-gray-600 text-sm">
          Enter your email to sign in or create an account
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
