// Core types for the application

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'staff' | 'admin';
  isAuthenticated: boolean;
  isEarlyRegistrationEnabled: boolean;
  hasRegisteredForCurrentYear: boolean;
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
}

export interface JobCategory {
  id: string;
  name: string;
  description: string;
}

export interface Shift {
  id: string;
  jobId: string;
  startTime: string;
  endTime: string;
  date: string;
  assignedUserId?: string;
}