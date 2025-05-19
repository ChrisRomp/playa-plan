import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { ROLES } from '../types/auth';

// Mock the useAuth hook from authUtils
vi.mock('../store/authUtils', () => ({
  useAuth: vi.fn()
}));

// Import after mocking to get the mocked version
import { useAuth } from '../store/authUtils';

describe('ProtectedRoute', () => {
  // Test components to simulate different pages
  const Dashboard = () => <div>Dashboard Page</div>;
  const Login = () => <div>Login Page</div>;
  const Admin = () => <div>Admin Page</div>;

  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });

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

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute requiresAuth={true} />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should redirect to login when not authenticated and route requires auth', () => {
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

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute requiresAuth={true} />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to login
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('should allow access to protected route when authenticated', () => {
    // Mock authenticated state
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: '1',
        email: 'user@example.playaplan.app',
        name: 'Test User',
        role: ROLES.USER,
        isAuthenticated: true,
        isEarlyRegistrationEnabled: false,
        hasRegisteredForCurrentYear: false
      },
      error: null,
      requestVerificationCode: vi.fn().mockResolvedValue(false),
      verifyCode: vi  .fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined)
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute requiresAuth={true} />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Should show protected content
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('should restrict access based on role', () => {
    // Mock authenticated state but with non-admin role
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: '1',
        email: 'user@example.playaplan.app',
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

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route element={<ProtectedRoute requiresAuth={true} allowedRoles={[ROLES.ADMIN]} />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to dashboard
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('should grant access when user has required role', () => {
    // Mock authenticated state with admin role
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: '1',
        email: 'admin@example.playaplan.app',
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

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<ProtectedRoute requiresAuth={true} allowedRoles={[ROLES.ADMIN]} />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Should show admin content
    expect(screen.getByText('Admin Page')).toBeInTheDocument();
  });

  it('should redirect authenticated users from login page to dashboard', () => {
    // Mock authenticated state
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: '1',
        email: 'user@example.playaplan.app',
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

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/login" element={<ProtectedRoute requiresAuth={false} />}>
            <Route index element={<Login />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to dashboard
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});
