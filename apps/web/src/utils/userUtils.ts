import { User } from '../types';

/**
 * Check if a user has staff or admin role
 * @param user The user object to check
 * @returns True if the user is staff or admin, false otherwise
 */
export const isStaffOrAdmin = (user?: User | null): boolean => {
  return Boolean(user?.role && ['staff', 'admin'].includes(user.role));
};
