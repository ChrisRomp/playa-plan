/**
 * Centralized route configuration
 * Defines all application routes and their properties
 */
import { UserRole, ROLES } from '../types/auth';

/**
 * Route configuration type
 */
export interface RouteConfig {
  path: string;
  name: string;
  requiresAuth: boolean;
  allowedRoles?: UserRole[];
}

/**
 * Application routes
 */
export const ROUTES = {
  HOME: {
    path: '/',
    name: 'Home',
    requiresAuth: false,
  },
  LOGIN: {
    path: '/login',
    name: 'Login',
    requiresAuth: false,
  },
  DASHBOARD: {
    path: '/dashboard',
    name: 'Dashboard',
    requiresAuth: true,
  },
  PROFILE: {
    path: '/profile',
    name: 'Profile',
    requiresAuth: true,
  },
  REGISTRATION: {
    path: '/registration',
    name: 'Registration',
    requiresAuth: true,
  },
  PAYMENT_SUCCESS: {
    path: '/payment/success',
    name: 'Payment Success',
    requiresAuth: true,
  },
  PAYMENT_CANCEL: {
    path: '/payment/cancel',
    name: 'Payment Cancelled',
    requiresAuth: true,
  },
  ADMIN: {
    path: '/admin',
    name: 'Admin',
    requiresAuth: true,
    allowedRoles: [ROLES.ADMIN],
  },
  ADMIN_CONFIG: {
    path: '/admin/configuration',
    name: 'Configuration',
    requiresAuth: true,
    allowedRoles: [ROLES.ADMIN],
  },
  ADMIN_USERS: {
    path: '/admin/users',
    name: 'User Management',
    requiresAuth: true,
    allowedRoles: [ROLES.ADMIN],
  },
  ADMIN_CAMPING_OPTIONS: {
    path: '/admin/camping-options',
    name: 'Camping Options',
    requiresAuth: true,
    allowedRoles: [ROLES.ADMIN],
  },
  ADMIN_CAMPING_OPTION_FIELDS: {
    path: '/admin/camping-options/:optionId/fields',
    name: 'Camping Option Fields',
    requiresAuth: true,
    allowedRoles: [ROLES.ADMIN],
  },
  ADMIN_JOB_CATEGORIES: {
    path: '/admin/job-categories',
    name: 'Job Categories',
    requiresAuth: true,
    allowedRoles: [ROLES.ADMIN],
  },
  ADMIN_JOBS: {
    path: '/admin/jobs',
    name: 'Jobs',
    requiresAuth: true,
    allowedRoles: [ROLES.ADMIN],
  },
  ADMIN_SHIFTS: {
    path: '/admin/shifts',
    name: 'Shifts',
    requiresAuth: true,
    allowedRoles: [ROLES.ADMIN],
  },
  SHIFTS: {
    path: '/shifts',
    name: 'Shifts',
    requiresAuth: true,
  },
  REPORTS: {
    path: '/reports',
    name: 'Reports',
    requiresAuth: true,
    allowedRoles: [ROLES.STAFF, ROLES.ADMIN],
  },
  REPORTS_REGISTRATIONS: {
    path: '/reports/registrations',
    name: 'Registration Reports',
    requiresAuth: true,
    allowedRoles: [ROLES.STAFF, ROLES.ADMIN],
  },
  REPORTS_USERS: {
    path: '/reports/users',
    name: 'User Reports',
    requiresAuth: true,
    allowedRoles: [ROLES.STAFF, ROLES.ADMIN],
  },
  REPORTS_WORK_SCHEDULE: {
    path: '/reports/work-schedule',
    name: 'Work Schedule Report',
    requiresAuth: true,
    allowedRoles: [ROLES.STAFF, ROLES.ADMIN],
  },
  REPORTS_PAYMENTS: {
    path: '/reports/payments',
    name: 'Payment Reports',
    requiresAuth: true,
    allowedRoles: [ROLES.ADMIN],
  },
  NOT_FOUND: {
    path: '*',
    name: 'Not Found',
    requiresAuth: false,
  },
} as const;

/**
 * Route path constants
 * Use these for programmatic navigation
 */
export const PATHS = Object.entries(ROUTES).reduce(
  (acc, [key, route]) => ({ ...acc, [key]: route.path }),
  {} as Record<keyof typeof ROUTES, string>
);

export type AppRoutes = typeof ROUTES;
export type RoutePath = keyof typeof PATHS;
