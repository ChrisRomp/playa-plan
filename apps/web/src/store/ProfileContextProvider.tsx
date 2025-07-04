import React, { useState, useEffect, ReactNode } from 'react';
import { useAuth } from './authUtils';
import { auth, api } from '../lib/api';
import { ProfileContext, UserProfile } from './ProfileContextDefinition';

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  // Check if profile is complete
  const checkProfileComplete = (profile: UserProfile | null): boolean => {
    if (!profile) return false;
    
    // Basic profile is complete if it has first name, last name, email, phone,
    // and emergency contact information
    return !!(
      profile.firstName &&
      profile.lastName &&
      profile.email &&
      profile.phone &&
      profile.emergencyContact
    );
  };

  // Fetch user profile when authenticated
  useEffect(() => {
    const fetchProfile = async () => {
      // Only attempt to fetch profile when we know authentication is established
      // and we have a valid user object
      if (!isAuthenticated || !user) {
        setProfile(null);
        setIsProfileComplete(false);
        return;
      }

      // Add a small delay to ensure authentication is fully established
      // This helps ensure cookies are properly set before making API calls
      setTimeout(async () => {
        setIsLoading(true);
        setError(null);

        try {
          // Use the auth service's getProfile method which uses the correct endpoint
          const userProfile = await auth.getProfile();
          
          // Build the profile from the API response
          const profile = {
            ...userProfile,
            isProfileComplete: false, // This will be calculated below
          };
          
          setProfile(profile);
          const complete = checkProfileComplete(profile);
          setIsProfileComplete(complete);
        } catch (err: unknown) {
          console.error('Failed to fetch user profile:', err);
          setError('Failed to load user profile');
          setIsProfileComplete(false);
          
          // If authentication fails, clear local authentication state to force re-login
          if (err && typeof err === 'object' && 'response' in err && 
              err.response && typeof err.response === 'object' && 'status' in err.response && 
              err.response.status === 401) {
            console.warn('Authentication token invalid or expired, authentication state will be updated');
            // With React Router, redirection should be handled by the components
            // using the isAuthenticated flag from AuthContext, not direct navigation here
          }
        } finally {
          setIsLoading(false);
        }
      }, 500); // Short delay to ensure auth is established
    };

    fetchProfile();
  }, [isAuthenticated, user]);

  // Update user profile
  const updateProfile = async (profileData: Partial<UserProfile>) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fix: Use PUT method as defined in the backend UserController
      // The backend endpoint is PUT /users/:id (not PATCH)
      const response = await api.put(`/users/${user.id}`, profileData);
      const updatedProfile = response.data;
      
      // Build the updated profile from the API response
      const profile = {
        ...updatedProfile,
        isProfileComplete: false, // This will be calculated below
      };
      
      setProfile(profile);
      const complete = checkProfileComplete(profile);
      setIsProfileComplete(complete);
      
      // If profile update was successful, return to the main page
      if (complete) {
        // With the React Router implementation, redirection is now handled by
        // the ProfilePage component using React Router's useNavigate hook
        // The isProfileComplete flag is still used to determine redirection
      }
    } catch (err: unknown) {
      console.error('Failed to update profile:', err);
      if (err && typeof err === 'object' && 'response' in err && 
          err.response && typeof err.response === 'object' && 'status' in err.response && 
          err.response.status === 401) {
        setError('Authentication expired. Please log in again.');
        // Consider redirecting to login page here
      } else {
        let errorMessage = 'Unknown error';
        if (err && typeof err === 'object' && 'response' in err && 
            err.response && typeof err.response === 'object' && 'data' in err.response && 
            err.response.data && typeof err.response.data === 'object' && 'message' in err.response.data) {
          errorMessage = String(err.response.data.message);
        }
        setError('Failed to update profile: ' + errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        error,
        isProfileComplete,
        updateProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};
