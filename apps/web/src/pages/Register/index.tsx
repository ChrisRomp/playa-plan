import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Form, FormField, FormActions } from '../../components/Form';
import { Card } from '../../components/Card';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';

const Register = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { register, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    
    if (!lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Email is invalid';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await register(email, password, firstName, lastName);
      navigate('/'); // Redirect to home on success
    } catch (err) {
      // Error is handled by the auth context
      console.error('Registration failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Create a new account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              sign in to your existing account
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
            
            <Form onSubmit={handleSubmit} initialErrors={formErrors}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <FormField label="First Name" htmlFor="firstName">
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    fullWidth
                    error={formErrors.firstName}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField label="Last Name" htmlFor="lastName">
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    fullWidth
                    error={formErrors.lastName}
                    disabled={isLoading}
                  />
                </FormField>
              </div>

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

              <FormField 
                label="Password" 
                htmlFor="password"
                hint="Use at least 8 characters including a number and a letter"
              >
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  fullWidth
                  error={formErrors.password}
                  disabled={isLoading}
                />
              </FormField>

              <FormField label="Confirm Password" htmlFor="confirmPassword">
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  fullWidth
                  error={formErrors.confirmPassword}
                  disabled={isLoading}
                />
              </FormField>

              <FormActions className="mt-6">
                <Button
                  type="submit"
                  fullWidth
                  isLoading={isLoading}
                >
                  Create Account
                </Button>
              </FormActions>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Register; 