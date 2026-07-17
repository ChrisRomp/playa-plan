/**
 * Represents days of the week for shift scheduling
 */
export enum DayOfWeek {
  PRE_OPENING = 'PRE_OPENING',
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
  POST_CLOSING = 'POST_CLOSING'
}

/**
 * Represents user roles in the system
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  PARTICIPANT = 'PARTICIPANT'
}

/**
 * Represents the status of a registration
 */
export enum RegistrationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED'
}

export { PaymentStatus } from './enums/payment-status.enum';

/**
 * Represents the payment method used
 */
export enum PaymentMethod {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL'
} 