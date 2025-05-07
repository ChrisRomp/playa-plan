import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileForm from '../components/profile/ProfileForm';
import { useProfile } from '../hooks/useProfile';
import { PATHS } from '../routes';

/**
 * Profile page component
 * Displays user profile form and handles navigation after completion
 */
const ProfilePage: React.FC = () => {
  const { isProfileComplete, isLoading } = useProfile();
  const navigate = useNavigate();
  
  // After profile is complete, redirect to dashboard
  React.useEffect(() => {
    if (!isLoading && isProfileComplete) {
      navigate(PATHS.DASHBOARD, { replace: true });
    }
  }, [isProfileComplete, isLoading, navigate]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        <ProfileForm />
      </div>
    </div>
  );
};

export default ProfilePage;
