import React, { useEffect } from 'react';
import { useProfile } from '../../hooks/useProfile';
import ProfileForm from './ProfileForm';

/**
 * Profile Page Component
 * Displays the profile form and handles redirecting after profile completion
 */
const ProfilePage: React.FC = () => {
  const { isProfileComplete, isLoading } = useProfile();
  
  // The MainContent component automatically handles displaying the correct view
  // based on the isProfileComplete state, so we don't need to do any redirection here
  // Just monitor the profile completion status for any other side effects if needed
  useEffect(() => {
    // This is intentionally left empty - the main content component 
    // will automatically render the appropriate view when profile is complete
  }, [isProfileComplete, isLoading]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h1 className="text-2xl font-bold mb-4">Complete Your Profile</h1>
        <p className="text-gray-700 mb-6">
          Before you can register for camp activities, please complete your profile information.
          This information is necessary for camp logistics and emergency situations.
        </p>
        
        <ProfileForm />
      </div>
    </div>
  );
};

export default ProfilePage;
