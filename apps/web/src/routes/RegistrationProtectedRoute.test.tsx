import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../store/authUtils';
import RegistrationProtectedRoute from './RegistrationProtectedRoute';

vi.mock('../hooks/useConfig', () => ({
  useConfig: vi.fn(),
}));

vi.mock('../store/authUtils', () => ({
  useAuth: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUseAuth = vi.mocked(useAuth);

const baseConfig = {
  name: 'Test Camp',
  description: 'Test',
  homePageBlurb: 'Test',
  registrationOpen: false,
  earlyRegistrationOpen: false,
  currentYear: 2026,
};

const baseUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  role: 'user' as const,
  isAuthenticated: true,
  isEarlyRegistrationEnabled: false,
  hasRegisteredForCurrentYear: false,
};

function mockConfig(overrides: Partial<typeof baseConfig> = {}): void {
  mockUseConfig.mockReturnValue({
    config: { ...baseConfig, ...overrides },
    isLoading: false,
    error: null,
    refreshConfig: vi.fn(),
    isConnecting: false,
    isConnected: true,
    connectionError: null,
  });
}

function mockAuth(overrides: Partial<typeof baseUser> = {}): void {
  mockUseAuth.mockReturnValue({
    user: { ...baseUser, ...overrides },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    requestVerificationCode: vi.fn(),
    verifyCode: vi.fn(),
    logout: vi.fn(),
    isConnecting: false,
    isConnected: true,
    connectionError: null,
  });
}

function renderRegistrationRoute(): void {
  render(
    <MemoryRouter initialEntries={['/registration']}>
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route element={<RegistrationProtectedRoute />}>
          <Route path="/registration" element={<div>Registration Flow</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RegistrationProtectedRoute', () => {
  beforeEach(() => {
    mockAuth();
    mockConfig();
  });

  it('should redirect to the dashboard when both registration windows are closed', () => {
    renderRegistrationRoute();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Registration Flow')).not.toBeInTheDocument();
  });

  it('should redirect an ineligible user during early registration', () => {
    mockConfig({ earlyRegistrationOpen: true });

    renderRegistrationRoute();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should allow an eligible user during early registration', () => {
    mockAuth({ isEarlyRegistrationEnabled: true });
    mockConfig({ earlyRegistrationOpen: true });

    renderRegistrationRoute();

    expect(screen.getByText('Registration Flow')).toBeInTheDocument();
  });

  it('should allow a user while general registration is open', () => {
    mockConfig({ registrationOpen: true });

    renderRegistrationRoute();

    expect(screen.getByText('Registration Flow')).toBeInTheDocument();
  });
});
