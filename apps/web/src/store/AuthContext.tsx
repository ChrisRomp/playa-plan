import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { auth } from '../lib/api';
import cookieService from '../lib/cookieService';

/**
 * Authentication context interface
 */
interface AuthContextType {
  user: User | null;
  requestVerificationCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

/**
 * Authentication context with default values
 */
const AuthContext = createContext<AuthContextType>({
  user: null,
  requestVerificationCode: async () => {},
  verifyCode: async () => {},
  logout: async () => {},
  isLoading: false,
  error: null,
  isAuthenticated: false
});

export const useAuth = () => useContext(AuthContext);

/**
 * Maps API role strings to client-side role enum values
 */
function mapApiRoleToClientRole(apiRole: string): 'admin' | 'staff' | 'user' {
  const role = apiRole.toUpperCase();
  if (role === 'ADMIN') return 'admin';
  if (role === 'STAFF') return 'staff';
  return 'user';
}

/**
 * AuthProvider component that manages authentication state
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // Initialize loading state to false and ensure it's reset on component mount
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Reset loading state on component mount
  useEffect(() => {
    // Always reset loading state when component mounts
    setIsLoading(false);
  }, []);

  // Check authentication status when the component mounts
  useEffect(() => {
    // Reset any previous error state
    setError(null);
    const checkAuthStatus = async () => {
      setIsLoading(true);
      try {
        // Check if the user is already authenticated (via cookie or session)
        const isAuthValid = await auth.checkAuth();
        setIsAuthenticated(isAuthValid);
        
        if (isAuthValid) {
          // If authenticated, fetch the user profile from the API
          const userProfile = await auth.getProfile();
          
          // Transform API user data to our client User type
          setUser({
            id: userProfile.id,
            name: `${userProfile.firstName} ${userProfile.lastName}`,
            email: userProfile.email,
            role: mapApiRoleToClientRole(userProfile.role),
            isAuthenticated: true,
            isEarlyRegistrationEnabled: false, // This would come from a complete profile
            hasRegisteredForCurrentYear: false // This would come from a complete profile
          });
        }
      } catch (err) {
        console.error('Authentication check failed:', err);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);

  /**
   * Request a verification code to be sent to the provided email
   */
  const requestVerificationCode = async (email: string) => {
    // Reset error state and set loading
    setError(null);
    setIsLoading(true);
    
    try {
      await auth.requestVerificationCode(email);
      // Store email for login/registration flow if needed
      if (email) {
        localStorage.setItem('pendingLoginEmail', email);
      }
    } catch (err) {
      setError('Failed to send verification code. Please try again.');
      console.error('Failed to send verification code:', err);
    } finally {
      // Always ensure loading state is reset
      setIsLoading(false);
    }
  };

  /**
   * Verify the provided code for the given email and login/register the user
   */
  const verifyCode = async (email: string, code: string) => {
    // Reset error state and set loading
    setError(null);
    setIsLoading(true);
    
    try {
      // Verify code with the API
      const authResponse = await auth.verifyCode(email, code);
      
      // Set authenticated state in cookie
      await cookieService.setAuthenticatedState();
      setIsAuthenticated(true);
      
      // Extract user info from auth response
      setUser({
        id: authResponse.userId,
        email: authResponse.email,
        name: `${authResponse.firstName} ${authResponse.lastName}`,
        role: mapApiRoleToClientRole(authResponse.role),
        isAuthenticated: true,
        // These would come from the complete user profile
        isEarlyRegistrationEnabled: false,
        hasRegisteredForCurrentYear: false
      });
      
      // Clear any stored email after successful verification
      localStorage.removeItem('pendingLoginEmail');
    } catch (err) {
      setError('Invalid verification code. Please try again.');
      console.error('Verification failed:', err);
    } finally {
      // Always ensure loading state is reset
      setIsLoading(false);
    }
  };

  /**
   * Log out the user by calling the logout API endpoint
   * and clearing local authentication state
   */
  const logout = async () => {
    setIsLoading(true);
    try {
      // Call the logout API endpoint which will clear HTTP-only cookies
      await auth.logout();
      
      // Clear local authentication state
      await cookieService.clearAuthTokens();
      setIsAuthenticated(false);
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
      // Even if the API call fails, we should still clear local state
      await cookieService.clearAuthTokens();
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        requestVerificationCode, 
        verifyCode, 
        logout, 
        isLoading, 
        error, 
        isAuthenticated 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};