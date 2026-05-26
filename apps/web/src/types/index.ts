// Core types for the application

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'staff' | 'admin';
  isAuthenticated: boolean;
  isEarlyRegistrationEnabled: boolean;
  hasRegisteredForCurrentYear: boolean;

  /**
   * Raw per-user permission flags, surfaced from the backend user profile
   * via AuthContext. These are optional so existing test fixtures that
   * construct a minimal User stay valid.
   *
   * Note: `isEarlyRegistrationEnabled` above is a derived alias of
   * `allowEarlyRegistration` retained for backward compatibility with
   * existing consumers.
   */
  allowRegistration?: boolean;
  allowEarlyRegistration?: boolean;
  allowDeferredDuesPayment?: boolean;
  allowNoJob?: boolean;

  /**
   * Whether the user has verified their email address.
   */
  isEmailVerified?: boolean;

  /**
   * URL to the user's profile picture.
   */
  profilePicture?: string | null;

  /**
   * ISO timestamps from the backend user record.
   */
  createdAt?: string;
  updatedAt?: string;

  /**
   * The user's first name, as provided in the backend user profile.
   */
  firstName?: string;
  
  /**
   * The user's last name, as provided in the backend user profile.
   */
  lastName?: string;
  
  /**
   * The user's "playa name" (nickname or alias), as provided in the backend user profile.
   */
  playaName?: string | null;
  
  /**
   * The user's phone number, as provided in the backend user profile.
   */
  phone?: string | null;
  
  /**
   * The city where the user resides, as provided in the backend user profile.
   */
  city?: string | null;
  
  /**
   * The state or province where the user resides, as provided in the backend user profile.
   */
  stateProvince?: string | null;
  
  /**
   * The country where the user resides, as provided in the backend user profile.
   */
  country?: string | null;
  
  /**
   * The user's emergency contact information, as provided in the backend user profile.
   */
  emergencyContact?: string | null;
}

export interface CampConfig {
  name: string;
  description: string;
  bannerUrl?: string;
  bannerAltText?: string;
  iconUrl?: string;
  iconAltText?: string;
  homePageBlurb: string;
  registrationOpen: boolean;
  earlyRegistrationOpen: boolean;
  currentYear: number;
  registrationTerms?: string;
  stripeEnabled?: boolean;
  stripePublicKey?: string;
  paypalEnabled?: boolean;
  paypalClientId?: string;
  paypalMode?: 'sandbox' | 'live';
  allowDeferredDuesPayment?: boolean;
  applicationApprovalRequired?: boolean;
}

export type RegistrationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'WAITLISTED'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_DECLINED';

export interface Registration {
  id: string;
  userId: string;
  year: number;
  status: RegistrationStatus;
  /**
   * When true, the participant opted to defer dues payment. The registration
   * is CONFIRMED (no payment required up front); the dashboard should still
   * surface a "Pay Now" CTA and a "Payment Deferred" indicator.
   */
  paymentDeferred?: boolean;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  decisionMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  jobs: RegistrationJob[];
  payments: Payment[];
}

export interface RegistrationJob {
  id: string;
  registrationId: string;
  jobId: string;
  createdAt: string;
  job: Job;
}

export interface Job {
  id: string;
  name: string;
  location: string;
  categoryId: string;
  shiftId: string;
  maxRegistrations: number;
  alwaysRequired: boolean;
  staffOnly: boolean;
  currentRegistrations?: number;
  category?: JobCategory;
  shift?: Shift;
}

export interface JobCategory {
  id: string;
  name: string;
  description?: string;
  alwaysRequired: boolean;
  location?: string;
  staffOnly: boolean;
}

export interface Shift {
  id: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  dayOfWeek: string;
}

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentProvider = 'STRIPE' | 'PAYPAL';

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerRefId?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  registrationId?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// Stripe Payment Types
export interface StripePaymentRequest {
  amount: number; // Amount in cents
  currency?: string;
  userId: string;
  registrationId?: string;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface StripePaymentResponse {
  paymentId: string;
  url?: string;
  clientSecret?: string;
}

export interface PaymentIntentConfirmation {
  paymentIntentId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  error?: string;
}

export interface CampingOptionField {
  id: string;
  displayName: string;
  description?: string | null;
  dataType: 'STRING' | 'MULTILINE_STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN' | 'DATE';
  required: boolean;
  maxLength?: number | null;
  minLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  order?: number;
  createdAt: string;
  updatedAt: string;
  campingOptionId: string;
}