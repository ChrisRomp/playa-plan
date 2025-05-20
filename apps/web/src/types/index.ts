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
}

export interface Registration {
  id: string;
  userId: string;
  year: number;
  status: 'pending' | 'approved' | 'rejected';
  arrivalDate?: string;
  departureDate?: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  shiftId: string;
}

export interface JobCategory {
  id: string;
  name: string;
  description: string;
}

export interface Shift {
  id: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  date: string;
  assignedUserId?: string;
}