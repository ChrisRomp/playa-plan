import React, { useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { auth, clearJwtToken, JWT_TOKEN_STORAGE_KEY, type UserProfile } from '../lib/api';
import { passkeysApi, isPasskeySupported } from '../lib/api/passkeys';
import { startAuthentication } from '@simplewebauthn/browser';
import cookieService from '../lib/cookieService';
import { AuthContext, mapApiRoleToClientRole } from './authUtils';
import { connectionManager, ConnectionStatus } from '../lib/connectionManager';

/**
 * Detects WebAuthn cancellations / aborts that should NOT surface as errors.
 * Covers DOMException("NotAllowedError") (most browsers when user dismisses
 * the picker) and SimpleWebAuthn's WebAuthnError with ERROR_CEREMONY_ABORTED.
 */
const isPasskeyCancellation = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: string };
  return e.name === 'NotAllowedError' || e.code === 'ERROR_CEREMONY_ABORTED';
};

/**
 * Build the client-side `User` from a parsed API user profile.
 *
 * Spreads the backend profile through to the store and overlays only the
 * derived/client-shaped fields below. Compared with the pre-#154 hand-rolled
 * whitelist, this collapses the field list to a single source of truth —
 * `UserSchema` in `apps/web/src/lib/api.ts` — so adding a new safe profile
 * field is a one-place change rather than two.
 *
 * Note: Zod's default object parsing strips unknown keys, so this is NOT a
 * blanket pass-through. A new backend field still needs to be added to
 * `UserSchema` to reach the client; that is deliberate.
 *
 * Overlaid fields:
 *
 * - `name`                       — composed from firstName + lastName.
 * - `role`                       — mapped from the backend's uppercase enum
 *                                  (`ADMIN`/`STAFF`/`PARTICIPANT`) to the
 *                                  client's lowercase enum.
 * - `isAuthenticated`            — always true at this point in the flow.
 * - `isEarlyRegistrationEnabled` — backward-compatible alias of
 *                                  `allowEarlyRegistration`. The raw flag is
 *                                  also surfaced by the spread above.
 * - `hasRegisteredForCurrentYear`— placeholder; would come from registration
 *                                  data fetched elsewhere.
 *
 * Excluded fields:
 *
 * - `internalNotes` — admin-only field about the user. Even though the
 *                    `/auth/profile` endpoint returns it for the user
 *                    themselves, it has no current-user use case on the
 *                    client and should not become part of global auth state.
 */
const buildClientUser = (userProfile: UserProfile): User => {
  // Intentionally drop internalNotes — see docstring above.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { internalNotes, ...safe } = userProfile;
  return {
    ...safe,
    name: `${userProfile.firstName} ${userProfile.lastName}`,
    role: mapApiRoleToClientRole(userProfile.role),
    isAuthenticated: true,
    isEarlyRegistrationEnabled: userProfile.allowEarlyRegistration || false,
    hasRegisteredForCurrentYear: false,
  };
};

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
            setUser(buildClientUser(userProfile));
            
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
   * Common post-authentication setup shared by the email-code and
   * passkey login paths. Sets the auth cookie, fetches the profile,
   * and updates context state. Runs the async work first so that on
   * profile-fetch failure the partial auth artifacts can be rolled
   * back before flipping isAuthenticated/user state.
   */
  const completeLogin = async (): Promise<void> => {
    try {
      await cookieService.setAuthenticatedState();
      const userProfile = await auth.getProfile();
      setUser(buildClientUser(userProfile));
      setIsAuthenticated(true);
      localStorage.removeItem('pendingLoginEmail');
    } catch (err) {
      // Roll back any persisted token / cookie so the user isn't left
      // half-authenticated after a successful API auth call.
      clearJwtToken();
      await cookieService.clearAuthTokens();
      setIsAuthenticated(false);
      setUser(null);
      throw err;
    }
  };

  /**
   * Verify the provided code for the given email and login/register the user
   */
  const verifyCode = async (email: string, code: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await auth.verifyCode(email, code);
      await completeLogin();
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Invalid verification code. Please try again.';
      setError(errorMessage);
      console.error('Verification failed:', err);
      // Defensive: also clear auth state in case the failure happened
      // before completeLogin ran (e.g., the verify call itself rejected).
      setIsAuthenticated(false);
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign in with a previously-registered passkey (discoverable / usernameless flow).
   * Performs the WebAuthn ceremony, hands the assertion to the API,
   * and finishes the login on success exactly like verifyCode.
   *
   * User cancellations (closing the OS passkey picker) are silently
   * ignored — they are an expected user action, not an error.
   */
  const loginWithPasskey = async (): Promise<void> => {
    if (!isPasskeySupported()) {
      const msg = 'This browser does not support passkeys.';
      setError(msg);
      throw new Error(msg);
    }
    setError(null);
    setIsLoading(true);
    try {
      const optionsJSON = (await passkeysApi.authenticationOptions()) as Parameters<
        typeof startAuthentication
      >[0]['optionsJSON'];
      const assertion = await startAuthentication({ optionsJSON });
      await passkeysApi.authenticationVerify(assertion);
      await completeLogin();
    } catch (err) {
      if (isPasskeyCancellation(err)) {
        // Don't surface cancellations to the UI.
        return;
      }
      const message = err instanceof Error ? err.message : 'Passkey sign-in failed';
      setError(message);
      setIsAuthenticated(false);
      setUser(null);
      throw err;
    } finally {
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
        loginWithPasskey,
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