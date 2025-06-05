/**
 * Email utility functions for consistent email handling across the application
 */

/**
 * Normalizes an email address to lowercase for consistent storage and comparison
 * @param email - The email address to normalize
 * @returns The email address in lowercase
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}