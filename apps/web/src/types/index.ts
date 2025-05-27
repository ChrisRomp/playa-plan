// Core types for the application

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'staff' | 'admin';
  isAuthenticated: boolean;
  isEarlyRegistrationEnabled: boolean;
  hasRegisteredForCurrentYear: boolean;
  allowDeferredDuesPayment?: boolean;
  
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
  playaName?: string;
  
  /**
   * The user's phone number, as provided in the backend user profile.
   */
  phone?: string;
  
  /**
   * The city where the user resides, as provided in the backend user profile.
   */
  city?: string;
  
  /**
   * The state or province where the user resides, as provided in the backend user profile.
   */
  stateProvince?: string;
  
  /**
   * The country where the user resides, as provided in the backend user profile.
   */
  country?: string;
  
  /**
   * The user's emergency contact information, as provided in the backend user profile.
   */
  emergencyContact?: string;
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
}

export type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';

export interface Registration {
  id: string;
  userId: string;
  year: number;
  status: RegistrationStatus;
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
  minValue?: number | null;
  maxValue?: number | null;
  order?: number;
  createdAt: string;
  updatedAt: string;
  campingOptionId: string;
}