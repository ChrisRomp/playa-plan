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
import AdminUserPage from '../pages/AdminUserPage.tsx';
import AdminCampingOptionsPage from '../pages/AdminCampingOptionsPage.tsx';
import AdminCampingOptionFieldsPage from '../pages/AdminCampingOptionFieldsPage.tsx';
import AdminJobCategoriesPage from '../pages/AdminJobCategoriesPage.tsx';
import AdminJobsPage from '../pages/AdminJobsPage.tsx';
import AdminShiftsPage from '../pages/AdminShiftsPage.tsx';
import ManageRegistrationsPage from '../pages/ManageRegistrationsPage.tsx';
import ShiftsPage from '../pages/ShiftsPage.tsx';
import RegistrationPage from '../pages/registration/RegistrationPage.tsx';
import RegistrationProtectedRoute from './RegistrationProtectedRoute.tsx';
import PaymentSuccessPage from '../pages/payment/PaymentSuccessPage.tsx';
import PaymentCancelPage from '../pages/payment/PaymentCancelPage.tsx';
import NotFoundPage from '../pages/NotFoundPage.tsx';
import { ReportsPage } from '../pages/ReportsPage.tsx';
import { RegistrationReportsPage } from '../pages/RegistrationReportsPage.tsx';
import { PaymentReportsPage } from '../pages/PaymentReportsPage.tsx';
import { UserReportsPage } from '../pages/UserReportsPage.tsx';
import { WorkScheduleReportPage } from '../pages/WorkScheduleReportPage.tsx';
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
        <Route path={ROUTES.PAYMENT_SUCCESS.path} element={<PaymentSuccessPage />} />
        <Route path={ROUTES.PAYMENT_CANCEL.path} element={<PaymentCancelPage />} />
      </Route>

      {/* Registration route with specialized protection */}
      <Route element={<RegistrationProtectedRoute />}>
        <Route path={ROUTES.REGISTRATION.path} element={<RegistrationPage />} />
      </Route>
      
      {/* Reports routes for staff and admin */}
      <Route element={<ProtectedRoute requiresAuth={true} allowedRoles={[ROLES.STAFF, ROLES.ADMIN]} />}>
        <Route path={ROUTES.REPORTS.path} element={<ReportsPage />} />
        <Route path={ROUTES.REPORTS_REGISTRATIONS.path} element={<RegistrationReportsPage />} />
        <Route path={ROUTES.REPORTS_USERS.path} element={<UserReportsPage />} />
        <Route path={ROUTES.REPORTS_WORK_SCHEDULE.path} element={<WorkScheduleReportPage />} />
      </Route>
      
      {/* Admin-only reports */}
      <Route element={<ProtectedRoute requiresAuth={true} allowedRoles={[ROLES.ADMIN]} />}>
        <Route path={ROUTES.REPORTS_PAYMENTS.path} element={<PaymentReportsPage />} />
      </Route>
      
      {/* Protected routes that require specific roles */}
      <Route element={<ProtectedRoute requiresAuth={true} allowedRoles={[ROLES.ADMIN]} />}>
        <Route path={ROUTES.ADMIN.path} element={<AdminPage />} />
        <Route path={ROUTES.ADMIN_CONFIG.path} element={<AdminConfigPage />} />
        <Route path={ROUTES.ADMIN_USERS.path} element={<AdminUserPage />} />
        <Route path={ROUTES.ADMIN_CAMPING_OPTIONS.path} element={<AdminCampingOptionsPage />} />
        <Route path={ROUTES.ADMIN_CAMPING_OPTION_FIELDS.path} element={<AdminCampingOptionFieldsPage />} />
        <Route path={ROUTES.ADMIN_JOB_CATEGORIES.path} element={<AdminJobCategoriesPage />} />
        <Route path={ROUTES.ADMIN_JOBS.path} element={<AdminJobsPage />} />
        <Route path={ROUTES.ADMIN_SHIFTS.path} element={<AdminShiftsPage />} />
        <Route path={ROUTES.ADMIN_MANAGE_REGISTRATIONS.path} element={<ManageRegistrationsPage />} />
      </Route>
      
      {/* 404 route */}
      <Route path={ROUTES.NOT_FOUND.path} element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRouter;
