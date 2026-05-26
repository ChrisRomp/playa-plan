import { RegistrationStatus } from '@prisma/client';

/**
 * Statuses that count toward camping option/job capacity.
 * Only registrations that have completed the full flow reserve spots.
 */
export const CAPACITY_RESERVING_STATUSES: readonly RegistrationStatus[] = [
  RegistrationStatus.PENDING,
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.WAITLISTED,
] as const;

/**
 * Application-phase statuses. These should NOT appear in payment flows,
 * job capacity counts, or shift reports.
 */
export const APPLICATION_STATUSES: readonly RegistrationStatus[] = [
  RegistrationStatus.APPLICATION_SUBMITTED,
  RegistrationStatus.APPLICATION_APPROVED,
  RegistrationStatus.APPLICATION_DECLINED,
] as const;

/**
 * Check if a status reserves capacity (counts toward maxSignups).
 */
export function isCapacityReservingStatus(status: RegistrationStatus | string): boolean {
  return (CAPACITY_RESERVING_STATUSES as readonly string[]).includes(status);
}

/**
 * Check if a status is an application-phase status.
 */
export function isApplicationStatus(status: RegistrationStatus | string): boolean {
  return (APPLICATION_STATUSES as readonly string[]).includes(status);
}
