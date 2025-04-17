import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Form, FormField, FormActions } from '../../components/Form';
import { Card } from '../../components/Card';
import { Navbar } from '../../components/Navbar';
import { AuthService } from '../../api/auth.service';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Email is invalid';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await AuthService.forgotPassword({ email });
      setSuccessMessage(response.message || 'If your email exists in our system, you will receive a password reset link');
      setEmail(''); // Clear form after successful submission
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
      console.error('Password reset request failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              return to sign in
            </Link>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card>
            {error && (
              <div className="mb-4 p-2 bg-red-50 text-red-800 rounded border border-red-200">
                {error}
              </div>
            )}
            
            {successMessage && (
              <div className="mb-4 p-2 bg-green-50 text-green-800 rounded border border-green-200">
                {successMessage}
              </div>
            )}
            
            {!successMessage ? (
              <Form onSubmit={handleSubmit} initialErrors={formErrors}>
                <p className="text-sm text-gray-700 mb-4">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                
                <FormField label="Email" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    fullWidth
                    error={formErrors.email}
                    disabled={isLoading}
                  />
                </FormField>

                <FormActions className="mt-6">
                  <Button
                    type="submit"
                    fullWidth
                    isLoading={isLoading}
                  >
                    Send Reset Link
                  </Button>
                </FormActions>
              </Form>
            ) : (
              <div className="mt-4 text-center">
                <Button 
                  variant="outline" 
                  onClick={() => setSuccessMessage(null)}
                >
                  Request another reset link
                </Button>
              </div>
            )}
            
            <div className="mt-6 text-center">
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 text-sm">
                Need an account? Sign up
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
