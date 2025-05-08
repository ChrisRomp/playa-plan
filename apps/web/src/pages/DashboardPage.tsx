import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { PATHS } from '../routes';

/**
 * Dashboard page component
 * Displays user dashboard with activities and options
 */
const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { profile, isProfileComplete } = useProfile(); // Destructure profile
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {!isProfileComplete && (
        <div className="bg-amber-100 border-l-4 border-amber-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                Please complete your profile to access all features.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Welcome,{' '}
            {(profile?.playaName && profile.playaName.trim() !== '') 
              ? profile.playaName 
              : (user?.name || 'Camper')}
            !
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">My Shifts</h3>
              <p className="text-gray-600 mb-3">View and manage your shift assignments</p>
              <Link to={PATHS.SHIFTS} className="text-blue-600 hover:text-blue-800 font-medium">
                Go to Shifts →
              </Link>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">My Profile</h3>
              <p className="text-gray-600 mb-3">Review and update your profile information</p>
              <Link to={PATHS.PROFILE} className="text-blue-600 hover:text-blue-800 font-medium">
                Edit Profile →
              </Link>
            </div>
            
            {user?.role === 'admin' && (
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-medium text-gray-900 mb-2">Admin Panel</h3>
                <p className="text-gray-600 mb-3">Access administrator controls</p>
                <Link to={PATHS.ADMIN} className="text-blue-600 hover:text-blue-800 font-medium">
                  Go to Admin →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
