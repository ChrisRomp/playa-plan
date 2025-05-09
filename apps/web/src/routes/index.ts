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
  SHIFTS: {
    path: '/shifts',
    name: 'Shifts',
    requiresAuth: true,
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
