import React, { useEffect } from 'react';
import ProfileForm from '../components/profile/ProfileForm';
import { useProfile } from '../hooks/useProfile';

/**
 * Profile page component
 * Displays user profile form
 */
const ProfilePage: React.FC = () => {
  const { isLoading } = useProfile();

  useEffect(() => {
    if (!isLoading) {
      // Use a timeout to ensure the ProfileForm and its elements are rendered
      // before attempting to set focus.
      const timerId = setTimeout(() => {
        const firstNameInput = document.getElementById('firstName');
        if (firstNameInput) {
          firstNameInput.focus();
        }
      }, 0); // 0ms delay pushes this to the end of the event queue

      return () => clearTimeout(timerId); // Cleanup the timeout
    }
  }, [isLoading]); // Re-run effect when isLoading changes

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
