import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ReportsPage } from '../ReportsPage';
import { useAuth } from '../../store/authUtils';
import type { User } from '../../types';

// Mock the useAuth hook
vi.mock('../../store/authUtils', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

const createMockUser = (role: 'user' | 'staff' | 'admin'): User => ({
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  role,
  isAuthenticated: true,
  isEarlyRegistrationEnabled: false,
  hasRegisteredForCurrentYear: false,
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('ReportsPage', () => {
  it('should render reports page title and description', () => {
    mockUseAuth.mockReturnValue({
      user: createMockUser('admin'),
      isAuthenticated: true,
      isLoading: false,
      error: null,
      logout: vi.fn(),
      requestVerificationCode: vi.fn(),
      verifyCode: vi.fn(),
    });

    renderWithRouter(<ReportsPage />);
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Reports');
    expect(screen.getByText('Access reports and analytics for camp management')).toBeInTheDocument();
  });

  it('should show all report types for admin users', () => {
    mockUseAuth.mockReturnValue({
      user: createMockUser('admin'),
      isAuthenticated: true,
      isLoading: false,
      error: null,
      logout: vi.fn(),
      requestVerificationCode: vi.fn(),
      verifyCode: vi.fn(),
    });

    renderWithRouter(<ReportsPage />);
    
    expect(screen.getByText('Registration Reports')).toBeInTheDocument();
    expect(screen.getByText('User Reports')).toBeInTheDocument();
    expect(screen.getByText('Payment Reports')).toBeInTheDocument();
  });

  it('should show limited report types for staff users', () => {
    mockUseAuth.mockReturnValue({
      user: createMockUser('staff'),
      isAuthenticated: true,
      isLoading: false,
      error: null,
      logout: vi.fn(),
      requestVerificationCode: vi.fn(),
      verifyCode: vi.fn(),
    });

    renderWithRouter(<ReportsPage />);
    
    expect(screen.getByText('Registration Reports')).toBeInTheDocument();
    expect(screen.getByText('User Reports')).toBeInTheDocument();
    expect(screen.queryByText('Payment Reports')).not.toBeInTheDocument();
  });

  it('should show no reports message for users without proper role', () => {
    mockUseAuth.mockReturnValue({
      user: createMockUser('user'),
      isAuthenticated: true,
      isLoading: false,
      error: null,
      logout: vi.fn(),
      requestVerificationCode: vi.fn(),
      verifyCode: vi.fn(),
    });

    renderWithRouter(<ReportsPage />);
    
    expect(screen.getByText('No Reports Available')).toBeInTheDocument();
    expect(screen.getByText("You don't have access to any reports with your current role.")).toBeInTheDocument();
  });

  it('should render report links with correct navigation', () => {
    mockUseAuth.mockReturnValue({
      user: createMockUser('admin'),
      isAuthenticated: true,
      isLoading: false,
      error: null,
      logout: vi.fn(),
      requestVerificationCode: vi.fn(),
      verifyCode: vi.fn(),
    });

    renderWithRouter(<ReportsPage />);
    
    const registrationLink = screen.getByRole('link', { name: /registration reports/i });
    const userLink = screen.getByRole('link', { name: /user reports/i });
    const paymentLink = screen.getByRole('link', { name: /payment reports/i });
    
    expect(registrationLink).toHaveAttribute('href', '/reports/registrations');
    expect(userLink).toHaveAttribute('href', '/reports/users');
    expect(paymentLink).toHaveAttribute('href', '/reports/payments');
  });
});
