import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { UserRole } from '../types/auth';
import { PATHS } from './index';

interface ProtectedRouteProps {
  requiresAuth: boolean;
  allowedRoles?: UserRole[];
}

/**
 * Protected route component that handles authentication and authorization
 * 
 * Routes can be protected in two ways:
 * 1. Authentication check - user must be logged in
 * 2. Role-based check - user must have required role(s)
 * 
 * If authentication is required but user is not logged in, redirects to login
 * If specific roles are required but user doesn't have them, redirects to dashboard
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  requiresAuth, 
  allowedRoles 
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Wait for auth check to complete
  if (isLoading) {
    return <div className="flex justify-center items-center h-36">Loading...</div>;
  }

  // If route requires authentication and user is not authenticated, redirect to login
  if (requiresAuth && !isAuthenticated) {
    // Store the attempted URL for redirecting after login
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${PATHS.LOGIN}?returnTo=${returnTo}`} replace />;
  }

  // If route requires specific roles and user doesn't have them, redirect to dashboard
  if (
    requiresAuth && 
    isAuthenticated && 
    allowedRoles && 
    allowedRoles.length > 0 && 
    user && 
    !allowedRoles.includes(user.role)
  ) {
    return <Navigate to={PATHS.DASHBOARD} replace />;
  }

  // If the user is authenticated but accessing a non-auth route like login, redirect to dashboard
  if (!requiresAuth && isAuthenticated && location.pathname === PATHS.LOGIN) {
    return <Navigate to={PATHS.DASHBOARD} replace />;
  }

  // Render the protected route content
  return <Outlet />;
};

export default ProtectedRoute;
