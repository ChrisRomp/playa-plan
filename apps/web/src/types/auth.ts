/**
 * Auth-related type definitions
 */

/**
 * User roles for the application
 * Matches roles defined in the API's Prisma schema
 */
export type UserRole = 'admin' | 'staff' | 'user';

// Legacy uppercase role constants for compatibility during transition
export const ROLES = {
  ADMIN: 'admin' as UserRole,
  STAFF: 'staff' as UserRole,
  USER: 'user' as UserRole,
  PARTICIPANT: 'user' as UserRole // Alias for backward compatibility
};

/**
 * User authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: UserProfile | null;
}

/**
 * User profile information
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}
