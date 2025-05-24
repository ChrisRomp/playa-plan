import { User, CampConfig } from '../types';

/**
 * Check if registration is currently accessible for a user
 * @param config - Camp configuration
 * @param user - Current user (optional, for checking early registration)
 * @returns boolean indicating if registration is accessible
 */
export const isRegistrationAccessible = (config: CampConfig | null, user: User | null): boolean => {
  if (!config) {
    return false;
  }

  // If general registration is open, anyone can register
  if (config.registrationOpen) {
    return true;
  }

  // If early registration is open and user is enabled for early registration
  if (config.earlyRegistrationOpen && user?.isEarlyRegistrationEnabled) {
    return true;
  }

  // Otherwise registration is not accessible
  return false;
};

/**
 * Get the registration status message for display to users
 * @param config - Camp configuration
 * @param user - Current user (optional)
 * @returns string describing current registration status
 */
export const getRegistrationStatusMessage = (config: CampConfig | null, user: User | null): string => {
  if (!config) {
    return 'Registration configuration not available.';
  }

  if (config.registrationOpen) {
    return `Registration for ${config.name} ${config.currentYear} is now open!`;
  }

  if (config.earlyRegistrationOpen) {
    if (user?.isEarlyRegistrationEnabled) {
      return `Early registration for ${config.name} ${config.currentYear} is available to you!`;
    } else {
      return 'Registration is not currently open. Early registration is available for selected members only.';
    }
  }

  return 'Registration is not currently open.';
}; 