import React from 'react';
import ProfileForm from '../components/profile/ProfileForm';
import { useProfile } from '../hooks/useProfile';

/**
 * Profile page component
 * Displays user profile form
 */
const ProfilePage: React.FC = () => {
  const { isLoading } = useProfile();

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        {isLoading ? (
          <div className="py-8 text-center">Loading your profile information...</div>
        ) : (
          <ProfileForm />
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
