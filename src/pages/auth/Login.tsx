import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [step, setStep] = useState<'email' | 'authCode'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // In a real app, this would send a request to generate an auth code
      // For now, we'll just move to the next step
      setTimeout(() => {
        setStep('authCode');
        setIsLoading(false);
        showNotification(`Authentication code sent to ${email}`, 'success');
      }, 1000);
    } catch (err) {
      console.error('Failed to send auth code:', err);
      showNotification('Failed to send authentication code. Please try again.', 'error');
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login(email, authCode);
      showNotification('Login successful!', 'success');
      navigate('/');
    } catch (err) {
      console.error('Login failed:', err);
      showNotification('Invalid authentication code. Please try again.', 'error');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {step === 'email' ? 'Sign in to your account' : 'Enter authentication code'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 'email' 
              ? 'Enter your email to receive an authentication code' 
              : `We sent a code to ${email}`}
          </p>
        </div>
        
        {step === 'email' ? (
          <form className="mt-8 space-y-6" onSubmit={handleEmailSubmit}>
            <div>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                label="Email address"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Button
                type="submit"
                fullWidth
                isLoading={isLoading}
              >
                Send code
              </Button>
            </div>
            
            <div className="text-center">
              <a href="/register" className="text-sm text-blue-600 hover:text-blue-500">
                Don't have an account? Sign up
              </a>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
            <div>
              <Input
                id="auth-code"
                name="authCode"
                type="text"
                autoComplete="one-time-code"
                required
                label="Authentication code"
                fullWidth
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
              />
            </div>

            <div>
              <Button
                type="submit"
                fullWidth
                isLoading={isLoading}
              >
                Sign in
              </Button>
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Back to email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login; 