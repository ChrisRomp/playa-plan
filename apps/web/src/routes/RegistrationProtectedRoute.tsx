import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../store/authUtils';
import { useConfig } from '../store/ConfigContextDefinition';
import { isRegistrationAccessible } from '../utils/registrationUtils';
import { PATHS } from './index';

/**
 * Protected route component specifically for registration access
 * 
 * Ensures that users can only access registration when:
 * 1. They are authenticated
 * 2. Registration is open OR early registration is open and they're enabled for it
 */
const RegistrationProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { config } = useConfig();

  // Wait for auth and config checks to complete
  if (isLoading || !config) {
    return <div className="flex justify-center items-center h-36">Loading...</div>;
  }

  // If user is not authenticated, redirect to login
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent('/registration');
    return <Navigate to={`${PATHS.LOGIN}?returnTo=${returnTo}`} replace />;
  }

  // If registration is not accessible, redirect to dashboard
  if (!isRegistrationAccessible(config, user)) {
    return <Navigate to={PATHS.DASHBOARD} replace />;
  }

  // Render the registration page
  return <Outlet />;
};

export default RegistrationProtectedRoute; 