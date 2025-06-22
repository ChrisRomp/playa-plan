/**
 * Profile Context Definition
 * 
 * This file contains only the context definition and interfaces, separating it from
 * the provider component to ensure React Fast Refresh works correctly.
 */
import { createContext } from 'react';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  country?: string | null;
  playaName?: string | null;
  profilePicture?: string | null;
  emergencyContact?: string | null;
  role: 'ADMIN' | 'STAFF' | 'PARTICIPANT';
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  isProfileComplete: boolean;
}

export interface ProfileContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  isProfileComplete: boolean;
  updateProfile: (profileData: Partial<UserProfile>) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  isLoading: false,
  error: null,
  isProfileComplete: false,
  updateProfile: async () => {},
});
