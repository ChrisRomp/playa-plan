export type UserRole = 'admin' | 'staff' | 'participant';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profileComplete: boolean;
}

export interface CoreConfiguration {
  id: string;
  campName: string;
  campDescription: string;
  campBannerUrl?: string;
  campBannerAltText?: string;
  campIconUrl?: string;
  campIconAltText?: string;
  homePageBlurb: string;
  isRegistrationOpen: boolean;
  isEarlyRegistrationOpen: boolean;
  currentCampYear: number;
  defaultCurrency: string;
  paymentProcessorsEnabled: {
    stripe: boolean;
    paypal: boolean;
  };
  contactEmail: string;
}

export interface Registration {
  id: string;
  userId: string;
  year: number;
  campingOption: string;
  arrivalDate?: string;
  departureDate?: string;
  paymentStatus: 'paid' | 'pending' | 'deferred' | 'failed';
  paymentAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkShift {
  id: string;
  jobId: string;
  jobName: string;
  categoryId: string;
  categoryName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description?: string;
  maxParticipants: number;
  currentParticipants: number;
} 