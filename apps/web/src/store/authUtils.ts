import { createContext, useContext } from 'react';
import { User } from '../types';

/**
 * Authentication context interface
 */
export interface AuthContextType {
  user: User | null;
  requestVerificationCode: (email: string) => Promise<boolean>;
  verifyCode: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  // Connection state
  isConnecting: boolean;
  isConnected: boolean;
  connectionError: string | null;
}

/**
 * Create the auth context with default values
 */
export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: false,
  user: null,
  error: null,
  requestVerificationCode: async () => false,
  verifyCode: async () => {},
  logout: async () => {},
  // Connection state defaults
  isConnecting: true,
  isConnected: false,
  connectionError: null,
});

/**
 * Hook to use the authentication context
 */
export const useAuth = () => useContext(AuthContext);

/**
 * Maps API role strings to client-side role enum values
 */
export function mapApiRoleToClientRole(apiRole: string): 'admin' | 'staff' | 'user' {
  const role = apiRole.toUpperCase();
  if (role === 'ADMIN') return 'admin';
  if (role === 'STAFF') return 'staff';
  return 'user';
}
