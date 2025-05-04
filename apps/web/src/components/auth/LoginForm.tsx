import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const { login, isLoading } = useAuth();
  const [error, setError] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    try {
      // Replace with actual API call to send verification code
      console.log(`Sending verification code to ${email}`);
      // Simulate API call
      setTimeout(() => {
        setCodeSent(true);
      }, 1000);
    } catch (error) {
      console.error('Failed to send verification code:', error);
      setError('Failed to send verification code');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!verificationCode) {
      setError('Verification code is required');
      return;
    }
    
    try {
      // Replace this with the actual verification logic
      await login(email, verificationCode);
    } catch (error) {
      console.error('Verification failed:', error);
      setError('Invalid verification code');
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">
        {isRegister ? 'Create Account' : 'Sign In'}
      </h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
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
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-amber-600 text-white font-medium py-2 px-4 rounded-md hover:bg-amber-700 transition-colors duration-300 disabled:bg-amber-400"
          >
            {isLoading ? (
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
                onClick={() => setCodeSent(false)}
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
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Enter the code sent to your email"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-amber-600 text-white font-medium py-2 px-4 rounded-md hover:bg-amber-700 transition-colors duration-300 disabled:bg-amber-400 mt-4"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </span>
            ) : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      )}
      
      <div className="mt-6 text-center">
        <button
          onClick={() => {
            setIsRegister(!isRegister);
            setCodeSent(false);
          }}
          className="text-amber-600 hover:text-amber-800 text-sm font-medium transition-colors"
        >
          {isRegister ? 'Already have an account? Sign In' : 'Need an account? Register'}
        </button>
      </div>
    </div>
  );
};

export default LoginForm;