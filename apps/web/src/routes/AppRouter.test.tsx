import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppRouter from './AppRouter';
import { ROUTES } from './index';
import { ROLES } from '../types/auth';

// Mock the useAuth hook
vi.mock('../store/authUtils', () => ({
  useAuth: vi.fn()
}));

// Import after mocking to get the mocked version
import { useAuth } from '../store/authUtils';

// Mock the page components to simplify testing
vi.mock('../pages/HomePage.tsx', () => ({
  default: () => <div data-testid="home-page">Home Page</div>
}));

vi.mock('../pages/LoginPage.tsx', () => ({
  default: () => <div data-testid="login-page">Login Page</div>
}));

vi.mock('../pages/DashboardPage.tsx', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard Page</div>
}));

vi.mock('../pages/ProfilePage.tsx', () => ({
  default: () => <div data-testid="profile-page">Profile Page</div>
}));

vi.mock('../pages/AdminPage.tsx', () => ({
  default: () => <div data-testid="admin-page">Admin Page</div>
}));

vi.mock('../pages/ShiftsPage.tsx', () => ({
  default: () => <div data-testid="shifts-page">Shifts Page</div>
}));

vi.mock('../pages/NotFoundPage.tsx', () => ({
  default: () => <div data-testid="not-found-page">Not Found Page</div>
}));

// Mock the auth context
vi.mock('../store/AuthContext', () => ({
  useAuth: vi.fn()
}));

describe('AppRouter', () => {
  // Helper function to render the router with a specified route
  const renderWithRoute = (route: string) => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <AppRouter />
      </MemoryRouter>
    );
  };

  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Public Routes', () => {
    it('should render HomePage for the root path', () => {
      renderWithRoute(ROUTES.HOME.path);
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    it('should render LoginPage for the login path', () => {
      renderWithRoute(ROUTES.LOGIN.path);
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  describe('Protected Routes', () => {
    it('should render DashboardPage when authenticated and accessing dashboard path', () => {
      // Mock authenticated state
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '1', 
          email: 'user@example.com', 
          name: 'Test User',
          role: ROLES.USER,
          isAuthenticated: true,
          isEarlyRegistrationEnabled: false,
          hasRegisteredForCurrentYear: false
        },
        error: null,
        requestVerificationCode: vi.fn().mockResolvedValue(false),
        verifyCode: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined)
      });

      renderWithRoute(ROUTES.DASHBOARD.path);
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    it('should redirect to login when not authenticated and accessing dashboard path', () => {
      // Mock unauthenticated state
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
        requestVerificationCode: vi.fn().mockResolvedValue(false),
        verifyCode: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined)
      });

      renderWithRoute(ROUTES.DASHBOARD.path);
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('should render ProfilePage when authenticated and accessing profile path', () => {
      // Mock authenticated state
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '1', 
          email: 'user@example.com', 
          name: 'Test User',
          role: ROLES.USER,
          isAuthenticated: true,
          isEarlyRegistrationEnabled: false,
          hasRegisteredForCurrentYear: false
        },
        error: null,
        requestVerificationCode: vi.fn().mockResolvedValue(false),
        verifyCode: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined)
      });

      renderWithRoute(ROUTES.PROFILE.path);
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });

    it('should render ShiftsPage when authenticated and accessing shifts path', () => {
      // Mock authenticated state
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '1', 
          email: 'user@example.com', 
          name: 'Test User',
          role: ROLES.USER,
          isAuthenticated: true,
          isEarlyRegistrationEnabled: false,
          hasRegisteredForCurrentYear: false
        },
        error: null,
        requestVerificationCode: vi.fn().mockResolvedValue(false),
        verifyCode: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined)
      });

      renderWithRoute(ROUTES.SHIFTS.path);
      expect(screen.getByTestId('shifts-page')).toBeInTheDocument();
    });
  });

  describe('Role-Based Routes', () => {
    it('should render AdminPage when authenticated as admin and accessing admin path', () => {
      // Mock admin authenticated state
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '1', 
          email: 'admin@example.com', 
          name: 'Admin User',
          role: ROLES.ADMIN,
          isAuthenticated: true,
          isEarlyRegistrationEnabled: false,
          hasRegisteredForCurrentYear: false
        },
        error: null,
        requestVerificationCode: vi.fn().mockResolvedValue(false),
        verifyCode: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined)
      });

      renderWithRoute(ROUTES.ADMIN.path);
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    it('should redirect to dashboard when authenticated as non-admin and accessing admin path', () => {
      // Mock regular user authenticated state
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { 
          id: '1', 
          email: 'user@example.com', 
          name: 'Regular User',
          role: ROLES.USER,
          isAuthenticated: true,
          isEarlyRegistrationEnabled: false,
          hasRegisteredForCurrentYear: false
        },
        error: null,
        requestVerificationCode: vi.fn().mockResolvedValue(false),
        verifyCode: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined)
      });

      renderWithRoute(ROUTES.ADMIN.path);
      // Regular users should be redirected to dashboard
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  describe('404 Route', () => {
    it('should render NotFoundPage for unknown routes', () => {
      renderWithRoute('/non-existent-route');
      expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state when authentication is being checked', () => {
      // Mock loading state
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        error: null,
        requestVerificationCode: vi.fn().mockResolvedValue(false),
        verifyCode: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined)
      });

      renderWithRoute(ROUTES.DASHBOARD.path);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });
});
