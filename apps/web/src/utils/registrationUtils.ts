import { CoreConfig } from '../lib/api';
import { CampConfig, User } from '../types';

/**
 * Type union for configuration that includes both CoreConfig and CampConfig
 */
type ConfigType = CoreConfig | CampConfig | null;

/**
 * Type union for user that includes both API User and types User
 */
type UserType = User | { allowEarlyRegistration?: boolean } | null;

/**
 * Helper function to check if config has registration fields
 */
function hasRegistrationFields(config: ConfigType): config is CoreConfig {
  return config !== null && 'registrationOpen' in config && 'earlyRegistrationOpen' in config && 'registrationYear' in config;
}

/**
 * Helper function to check if config has year field
 */
function hasYearField(config: ConfigType): config is CampConfig {
  return config !== null && 'currentYear' in config;
}

/**
 * Check if registration is currently accessible to the user
 * @param config - The core configuration or camp configuration
 * @param user - The current user (optional)
 * @returns True if registration is accessible, false otherwise
 */
export function isRegistrationAccessible(config: ConfigType, user: UserType): boolean {
  if (!config) return false;
  
  // Check if this is a CoreConfig with registration fields
  if (hasRegistrationFields(config)) {
    // Check if general registration is open
    if (config.registrationOpen) return true;
    
    // Check if early registration is open and user is allowed early registration
    const userAllowsEarly = user && 'allowEarlyRegistration' in user ? user.allowEarlyRegistration : 
                           user && 'isEarlyRegistrationEnabled' in user ? user.isEarlyRegistrationEnabled : false;
    if (config.earlyRegistrationOpen && userAllowsEarly) return true;
  }
  
  // For CampConfig, check registrationOpen field
  if ('registrationOpen' in config && config.registrationOpen) return true;
  
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
  user: UserType, 
  hasExistingRegistration: boolean
): boolean {
  // First check if registration is accessible at all
  if (!isRegistrationAccessible(config, user)) {
    return false;
  }
  
  // Then check if user is already registered
  if (hasExistingRegistration) {
    return false;
  }
  
  return true;
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
  user: UserType,
  hasExistingRegistration: boolean
): string {
  if (!config) {
    return 'Configuration not available. Please try again later.';
  }
  
  // Get the year from the appropriate config type
  const year = hasRegistrationFields(config) ? config.registrationYear : 
               hasYearField(config) ? config.currentYear : 
               new Date().getFullYear();
  
  if (hasExistingRegistration) {
    return `You are already registered for ${year}. You can view your registration details on the dashboard.`;
  }
  
  // Handle CoreConfig type
  if (hasRegistrationFields(config)) {
    if (!config.registrationOpen && !config.earlyRegistrationOpen) {
      return `Registration for ${config.registrationYear} is not currently open.`;
    }
    
    const userAllowsEarly = user && 'allowEarlyRegistration' in user ? user.allowEarlyRegistration : 
                           user && 'isEarlyRegistrationEnabled' in user ? user.isEarlyRegistrationEnabled : false;
    if (config.earlyRegistrationOpen && !config.registrationOpen && !userAllowsEarly) {
      return `Early registration for ${config.registrationYear} is currently open for eligible participants only. General registration will open later.`;
    }
  }
  
  return `Registration for ${year} is not currently available.`;
} 