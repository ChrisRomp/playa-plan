import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { ROUTES } from './index';

// Page components
import HomePage from '../pages/HomePage.tsx';
import LoginPage from '../pages/LoginPage.tsx';
import DashboardPage from '../pages/DashboardPage.tsx';
import ProfilePage from '../pages/ProfilePage.tsx';
import AdminPage from '../pages/AdminPage.tsx';
import AdminConfigPage from '../pages/AdminConfigPage.tsx';
import ShiftsPage from '../pages/ShiftsPage.tsx';
import NotFoundPage from '../pages/NotFoundPage.tsx';
import { ROLES } from '../types/auth.ts';

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
      <Route element={<ProtectedRoute requiresAuth={true} allowedRoles={[ROLES.ADMIN]} />}>
        <Route path={ROUTES.ADMIN.path} element={<AdminPage />} />
        <Route path={ROUTES.ADMIN_CONFIG.path} element={<AdminConfigPage />} />
      </Route>
      
      {/* 404 route */}
      <Route path={ROUTES.NOT_FOUND.path} element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRouter;
