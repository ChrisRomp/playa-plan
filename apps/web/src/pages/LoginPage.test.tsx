import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../store/authUtils';

vi.mock('../hooks/useConfig', () => ({
  useConfig: vi.fn(),
}));

vi.mock('../store/authUtils', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../components/auth/LoginForm', () => ({
  default: () => <div>Login Form</div>,
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseConfig = vi.mocked(useConfig);

const renderLoginPage = (inputReturnTo: string): void => {
  const inputEntry = `/login?returnTo=${encodeURIComponent(inputReturnTo)}`;

  render(
    <MemoryRouter initialEntries={[inputEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/registration" element={<div>Registration Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: null,
      error: null,
      requestVerificationCode: vi.fn().mockResolvedValue(false),
      verifyCode: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
    });
    mockUseConfig.mockReturnValue({
      config: null,
      isLoading: false,
      error: null,
      refreshConfig: vi.fn(),
      isConnecting: false,
      isConnected: true,
      connectionError: null,
    });
  });

  it('should navigate authenticated users to a safe return path', async () => {
    renderLoginPage('/registration?step=2');

    expect(await screen.findByText('Registration Page')).toBeInTheDocument();
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '\\\\evil.example',
    '/administrator',
  ])('should navigate unsafe return target %s to the dashboard', async inputReturnTo => {
    renderLoginPage(inputReturnTo);

    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
  });
});
