import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { ROUTES } from './index';

// Page components
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import ProfilePage from '../pages/ProfilePage';
import AdminPage from '../pages/AdminPage';
import ShiftsPage from '../pages/ShiftsPage';
import NotFoundPage from '../pages/NotFoundPage';

/**
 * Application router component
 * 
 * Defines the routing structure for the entire application,
 * using the protected route component to handle auth requirements
 */
const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path={ROUTES.HOME.path} element={<HomePage />} />
      <Route path={ROUTES.LOGIN.path} element={<LoginPage />} />
      
      {/* Protected routes that require authentication */}
      <Route element={<ProtectedRoute requiresAuth={true} />}>
        <Route path={ROUTES.DASHBOARD.path} element={<DashboardPage />} />
        <Route path={ROUTES.PROFILE.path} element={<ProfilePage />} />
        <Route path={ROUTES.SHIFTS.path} element={<ShiftsPage />} />
      </Route>
      
      {/* Protected routes that require specific roles */}
      <Route element={<ProtectedRoute requiresAuth={true} allowedRoles={['ADMIN']} />}>
        <Route path={ROUTES.ADMIN.path} element={<AdminPage />} />
      </Route>
      
      {/* 404 route */}
      <Route path={ROUTES.NOT_FOUND.path} element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRouter;
