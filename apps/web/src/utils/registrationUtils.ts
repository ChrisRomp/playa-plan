import { CoreConfig } from '../lib/api';
import { CampConfig, User } from '../types';

/**
 * Type union for configuration that includes both CoreConfig and CampConfig
 */
type ConfigType = CoreConfig | CampConfig | null;

/**
 * Type union for user that includes both API User and types User
 */
type UserType = User | { allowEarlyRegistration?: boolean; isEarlyRegistrationEnabled?: boolean } | null;

/**
 * Check if registration is currently accessible to the user
 * @param config - The core configuration or camp configuration
 * @param user - The current user (optional)
 * @returns True if registration is accessible, false otherwise
 */
export function isRegistrationAccessible(config: ConfigType, user: UserType | null): boolean {
  if (!config) return false;
  
  // Check if general registration is open
  if ('registrationOpen' in config && config.registrationOpen) return true;
  
  // Check if early registration is open and user is allowed early registration
  if ('earlyRegistrationOpen' in config && config.earlyRegistrationOpen && user) {
    // Check for both possible property names
    const isEarlyEligible = 'isEarlyRegistrationEnabled' in user 
      ? user.isEarlyRegistrationEnabled 
      : 'allowEarlyRegistration' in user 
        ? user.allowEarlyRegistration 
        : false;
    
    if (isEarlyEligible) return true;
  }
  
  return false;
}

/**
 * Check if user should be allowed to start a new registration
 * This checks both if registration is open AND if the user doesn't have an active registration
 * @param config - The core configuration or camp configuration
 * @param user - The current user (optional)
 * @param hasActiveRegistration - Whether the user already has an active (non-cancelled) registration
 * @returns True if user can start registration, false otherwise
 */
export function canUserRegister(
  config: ConfigType, 
  user: UserType | null, 
  hasActiveRegistration: boolean
): boolean {
  // If user already has an active registration, they can't register again
  if (hasActiveRegistration) return false;
  
  // Otherwise, check if registration is accessible
  return isRegistrationAccessible(config, user);
}

/**
 * Get the appropriate message for why registration is not accessible
 * @param config - The core configuration or camp configuration
 * @param user - The current user (optional)
 * @param hasActiveRegistration - Whether the user already has an active (non-cancelled) registration
 * @returns Message explaining why registration is not accessible
 */
export function getRegistrationStatusMessage(
  config: ConfigType,
  user: UserType | null,
  hasActiveRegistration: boolean
): string {
  if (!config) {
    return 'Configuration not available. Please try again later.';
  }
  
  // Get the year from the appropriate config type
  const year = 'registrationYear' in config ? config.registrationYear : 
               'currentYear' in config ? config.currentYear : 
               new Date().getFullYear();
  
  if (hasActiveRegistration) {
    return `You are already registered for ${year}. You can view your registration details on the dashboard.`;
  }
  
  const isRegistrationOpen = 'registrationOpen' in config && config.registrationOpen;
  const isEarlyRegistrationOpen = 'earlyRegistrationOpen' in config && config.earlyRegistrationOpen;
  
  if (!isRegistrationOpen && !isEarlyRegistrationOpen) {
    return `Registration for ${year} is not currently open.`;
  }
  
  if (isEarlyRegistrationOpen && !isRegistrationOpen) {
    const isEarlyEligible = user && (
      ('isEarlyRegistrationEnabled' in user && user.isEarlyRegistrationEnabled) ||
      ('allowEarlyRegistration' in user && user.allowEarlyRegistration)
    );
    
    if (isEarlyEligible) {
      return `Early registration for ${year} is open!`;
    } else {
      // Show the same default message as when registration is closed
      return `Registration for ${year} is not currently open.`;
    }
  }
  
  return `Registration for ${year} is open!`;
} 