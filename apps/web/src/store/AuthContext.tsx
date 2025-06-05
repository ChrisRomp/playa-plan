import React, { useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { auth, clearJwtToken, JWT_TOKEN_STORAGE_KEY } from '../lib/api';
import cookieService from '../lib/cookieService';
import { AuthContext, mapApiRoleToClientRole } from './authUtils';
import { connectionManager, ConnectionStatus } from '../lib/connectionManager';



/**
 * AuthProvider component that manages authentication state
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // Initialize loading state to false and ensure it's reset on component mount
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Connection state
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Reset loading state on component mount
  useEffect(() => {
    // Always reset loading state when component mounts
    setIsLoading(false);
  }, []);

  // Set up connection manager listener
  useEffect(() => {
    const handleConnectionStatusChange = (status: ConnectionStatus) => {
      setIsConnecting(status.isConnecting);
      setIsConnected(status.isConnected);
      setConnectionError(status.connectionError);
    };

    connectionManager.addListener(handleConnectionStatusChange);
    connectionManager.startPeriodicCheck();

    return () => {
      connectionManager.removeListener(handleConnectionStatusChange);
      connectionManager.stopPeriodicCheck();
    };
  }, []);

  // Check authentication status when the component mounts
  useEffect(() => {
    // Reset any previous error state
    setError(null);
    
    const checkAuthStatus = async () => {
      setIsLoading(true);
      
      try {
        // Check if the JWT token exists in localStorage directly first
        const hasTokenInStorage = localStorage.getItem(JWT_TOKEN_STORAGE_KEY) !== null;
        
        // Set the auth cookie if token exists but cookie doesn't
        if (hasTokenInStorage && !cookieService.isAuthenticated()) {
          console.log('Found JWT token but no auth cookie - restoring cookie state');
          await cookieService.setAuthenticatedState();
        }
        
        // Check authentication with the API
        const isAuthValid = await auth.checkAuth();
        setIsAuthenticated(isAuthValid);
        
        // Only fetch profile if auth check passed
        if (isAuthValid) {
          try {
            // If authenticated, fetch the user profile from the API
            const userProfile = await auth.getProfile();
            
            // Transform API user data to our client User type
            setUser({
              id: userProfile.id,
              name: `${userProfile.firstName} ${userProfile.lastName}`,
              email: userProfile.email,
              role: mapApiRoleToClientRole(userProfile.role),
              isAuthenticated: true,
              isEarlyRegistrationEnabled: userProfile.allowEarlyRegistration || false,
              hasRegisteredForCurrentYear: false // This would come from registration data
            });
            
            // Set the client-side auth state cookie for UI state
            await cookieService.setAuthenticatedState();
          } catch (profileErr) {
            console.error('Profile fetch failed:', profileErr);
            setIsAuthenticated(false);
            setUser(null);
            await cookieService.clearAuthTokens();
          }
        } else {
          // Auth test failed, clear user data
          setUser(null);
          await cookieService.clearAuthTokens();
        }
      } catch (err) {
        console.error('Authentication check failed:', err);
        setIsAuthenticated(false);
        setUser(null);
        await cookieService.clearAuthTokens();
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);

  /**
   * Request a verification code to be sent to the provided email
   * @returns boolean indicating whether the verification code was successfully sent
   */
  const requestVerificationCode = async (email: string): Promise<boolean> => {
    // Reset error state and set loading
    setError(null);
    setIsLoading(true);
    
    try {
      await auth.requestVerificationCode(email);
      // Store email for login/registration flow if needed
      if (email) {
        localStorage.setItem('pendingLoginEmail', email);
      }
      return true; // Success
    } catch (err) {
      setError('Failed to send verification code. Please try again.');
      console.error('Failed to send verification code:', err);
      return false; // Failure
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
      
      // The JWT token is already stored in localStorage by auth.verifyCode method
      // via the setJwtToken function, but we also set the auth state cookie for UI
      await cookieService.setAuthenticatedState();
      setIsAuthenticated(true);
      
      // Get the full user profile after successful authentication
      const userProfile = await auth.getProfile();
      
      // Extract user info from profile response
      setUser({
        id: authResponse.userId,
        email: authResponse.email,
        name: `${authResponse.firstName} ${authResponse.lastName}`,
        role: mapApiRoleToClientRole(authResponse.role),
        isAuthenticated: true,
        isEarlyRegistrationEnabled: userProfile.allowEarlyRegistration || false,
        hasRegisteredForCurrentYear: false
      });
      
      // Clear any stored email after successful verification
      localStorage.removeItem('pendingLoginEmail');
    } catch (err) {
      // Extract error message from the Error object or use a default message
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Invalid verification code. Please try again.';
      
      setError(errorMessage);
      console.error('Verification failed:', err);
      
      // Clear authentication state on verification failure
      setIsAuthenticated(false);
      setUser(null);
      
      // Rethrow the error so it can be caught by the component
      throw err;
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
      clearJwtToken(); // Clear JWT token from memory and request headers
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
        isAuthenticated,
        // Connection state
        isConnecting,
        isConnected,
        connectionError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};