import { CoreConfig } from '../lib/api';
import { CampConfig, RegistrationStatus as RegistrationStatusType, User } from '../types';

/**
 * Registration status enum to match backend
 */
export enum RegistrationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  WAITLISTED = 'WAITLISTED',
  APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
  APPLICATION_APPROVED = 'APPLICATION_APPROVED',
  APPLICATION_DECLINED = 'APPLICATION_DECLINED',
}

export function isApplicationStatus(status?: string | null): boolean {
  return status === RegistrationStatus.APPLICATION_SUBMITTED
    || status === RegistrationStatus.APPLICATION_APPROVED
    || status === RegistrationStatus.APPLICATION_DECLINED;
}

const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  WAITLISTED: 'Waitlisted',
  APPLICATION_SUBMITTED: 'Application Submitted',
  APPLICATION_APPROVED: 'Application Approved',
  APPLICATION_DECLINED: 'Application Not Approved',
};

export type RegistrationStatusGroup = 'CONFIRMED' | 'PENDING' | 'CANCELLED';

export const REGISTRATION_STATUS_GROUPS: Record<
  RegistrationStatusGroup,
  readonly RegistrationStatusType[]
> = {
  CONFIRMED: ['CONFIRMED'],
  PENDING: ['PENDING', 'WAITLISTED', 'APPLICATION_SUBMITTED', 'APPLICATION_APPROVED'],
  CANCELLED: ['CANCELLED', 'APPLICATION_DECLINED'],
};

export const REGISTRATION_STATUS_BADGE_CLASSES: Record<RegistrationStatusType, string> = {
  CONFIRMED: 'bg-green-100 text-green-800',
  PENDING: 'bg-amber-100 text-amber-800',
  WAITLISTED: 'bg-orange-100 text-orange-800',
  APPLICATION_SUBMITTED: 'bg-blue-100 text-blue-800',
  APPLICATION_APPROVED: 'bg-purple-100 text-purple-800',
  APPLICATION_DECLINED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

export function matchesRegistrationStatusGroup(
  status: RegistrationStatusType,
  filterGroup?: RegistrationStatusGroup,
): boolean {
  return filterGroup === undefined
    || REGISTRATION_STATUS_GROUPS[filterGroup].includes(status);
}

export function getRegistrationStatusBadgeClasses(status: RegistrationStatusType): string {
  return REGISTRATION_STATUS_BADGE_CLASSES[status];
}

/**
 * Convert a registration status enum value to a human-readable label.
 */
export function formatRegistrationStatus(status: string): string {
  return REGISTRATION_STATUS_LABELS[status] ?? status;
}

/**
 * Type union for configuration that includes both CoreConfig and CampConfig
 */
type ConfigType = CoreConfig | CampConfig | null;

/**
 * Type union for user that includes both API User and types User
 */
type UserType = User | { allowRegistration?: boolean; allowEarlyRegistration?: boolean; isEarlyRegistrationEnabled?: boolean } | null;

/**
 * Determine whether the per-user allowRegistration flag explicitly denies
 * registration. A value of `false` blocks registration entirely; `undefined`
 * is treated as allowed for backward compatibility with user fixtures and
 * older API responses that do not surface the flag.
 */
function isUserRegistrationBlocked(user: UserType | null): boolean {
  return user?.allowRegistration === false;
}

/**
 * Check if registration is currently accessible to the user
 * @param config - The core configuration or camp configuration
 * @param user - The current user (optional)
 * @returns True if registration is accessible, false otherwise
 */
export function isRegistrationAccessible(config: ConfigType, user: UserType | null): boolean {
  if (!config) return false;

  // If the per-user allowRegistration flag is explicitly disabled, the user
  // cannot register regardless of the global registration toggles.
  if (isUserRegistrationBlocked(user)) return false;

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
 * Check if user should be allowed to access the registration flow.
 * Returns true when registration is accessible to the user and they either have
 * no active registration or have an active application-phase registration that
 * can be viewed or continued.
 * @param config - The core configuration or camp configuration
 * @param user - The current user (optional)
 * @param hasActiveRegistration - Whether the user already has an active (non-cancelled) registration
 * @param registrationStatus - Current registration status (used for application-phase checks)
 * @returns True if user can access the registration flow, false otherwise
 */
export function canUserRegister(
  config: ConfigType,
  user: UserType | null,
  hasActiveRegistration: boolean,
  registrationStatus?: string | null,
): boolean {
  if (!isRegistrationAccessible(config, user)) {
    return false;
  }

  if (hasActiveRegistration) {
    return isApplicationStatus(registrationStatus);
  }

  return true;
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
  hasActiveRegistration: boolean,
  registrationStatus?: string | null,
): string {
  if (!config) {
    return 'Configuration not available. Please try again later.';
  }
  
  // Get the year from the appropriate config type
  const year = 'registrationYear' in config ? config.registrationYear : 
               'currentYear' in config ? config.currentYear : 
               new Date().getFullYear();
  
  if (hasActiveRegistration) {
    if (registrationStatus === RegistrationStatus.APPLICATION_SUBMITTED) {
      return `Your application for ${year} is pending review.`;
    }

    if (registrationStatus === RegistrationStatus.APPLICATION_APPROVED) {
      return `Your application for ${year} has been approved. Continue to complete your registration.`;
    }

    if (registrationStatus === RegistrationStatus.APPLICATION_DECLINED) {
      return `Your application for ${year} was not approved.`;
    }

    return `You are already registered for ${year}. You can view your registration details on the dashboard.`;
  }

  // If the per-user allowRegistration flag is explicitly disabled, surface a
  // specific message so the user knows registration has been disabled for
  // their account rather than implying registration is globally closed.
  if (isUserRegistrationBlocked(user)) {
    return `Registration for ${year} is not available for your account. Please contact an administrator if you believe this is in error.`;
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

/**
 * Filter registrations to only include active (non-cancelled) ones
 * @param registrations - Array of registrations
 * @returns Array of active registrations
 */
export function getActiveRegistrations<T extends { status: string }>(registrations: T[]): T[] {
  return registrations.filter(reg => reg.status !== RegistrationStatus.CANCELLED);
}

/**
 * Filter registrations to only include cancelled ones
 * @param registrations - Array of registrations
 * @returns Array of cancelled registrations
 */
export function getCancelledRegistrations<T extends { status: string }>(registrations: T[]): T[] {
  return registrations.filter(reg => reg.status === RegistrationStatus.CANCELLED);
} 