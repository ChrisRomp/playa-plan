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
 * This checks both if registration is open AND if the user isn't already registered
 * @param config - The core configuration or camp configuration
 * @param user - The current user (optional)
 * @param hasExistingRegistration - Whether the user already has a registration
 * @returns True if user can start registration, false otherwise
 */
export function canUserRegister(
  config: ConfigType, 
  user: UserType | null, 
  hasExistingRegistration: boolean
): boolean {
  // If user already has a registration, they can't register again
  if (hasExistingRegistration) return false;
  
  // Otherwise, check if registration is accessible
  return isRegistrationAccessible(config, user);
}

/**
 * Get the appropriate message for why registration is not accessible
 * @param config - The core configuration or camp configuration
 * @param user - The current user (optional)
 * @param hasExistingRegistration - Whether the user already has a registration
 * @returns Message explaining why registration is not accessible
 */
export function getRegistrationStatusMessage(
  config: ConfigType,
  user: UserType | null,
  hasExistingRegistration: boolean
): string {
  if (!config) {
    return 'Configuration not available. Please try again later.';
  }
  
  // Get the year from the appropriate config type
  const year = 'registrationYear' in config ? config.registrationYear : 
               'currentYear' in config ? config.currentYear : 
               new Date().getFullYear();
  
  if (hasExistingRegistration) {
    return `You are already registered for ${year}. You can view your registration details on the dashboard.`;
  }
  
  const isRegistrationOpen = 'registrationOpen' in config && config.registrationOpen;
  const isEarlyRegistrationOpen = 'earlyRegistrationOpen' in config && config.earlyRegistrationOpen;
  
  if (!isRegistrationOpen && !isEarlyRegistrationOpen) {
    return `Registration for ${year} is not currently available.`;
  }
  
  if (isEarlyRegistrationOpen && !isRegistrationOpen) {
    const isEarlyEligible = user && (
      ('isEarlyRegistrationEnabled' in user && user.isEarlyRegistrationEnabled) ||
      ('allowEarlyRegistration' in user && user.allowEarlyRegistration)
    );
    
    if (isEarlyEligible) {
      return `Early registration for ${year} is now open!`;
    } else {
      return `Early registration is available for selected members only.`;
    }
  }
  
  return `Registration for ${year} is now open!`;
} 