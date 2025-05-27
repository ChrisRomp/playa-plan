import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import DashboardPage from '../DashboardPage';

// Mock all the hooks and contexts
vi.mock('../../store/authUtils', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useProfile', () => ({
  useProfile: vi.fn(),
}));

vi.mock('../../hooks/useUserRegistrations', () => ({
  useUserRegistrations: vi.fn(),
}));

vi.mock('../../hooks/useCampRegistration', () => ({
  useCampRegistration: vi.fn(),
}));

vi.mock('../../store/ConfigContextDefinition', () => ({
  useConfig: vi.fn(),
}));

vi.mock('../../components/payment/PaymentButton', () => ({
  default: vi.fn(({ children, amount, onPaymentStart }) => (
    <button 
      onClick={onPaymentStart}
      data-testid="payment-button"
      data-amount={amount}
    >
      {children}
    </button>
  )),
}));

// Import the mocked functions
import { useAuth } from '../../store/authUtils';
import { useProfile } from '../../hooks/useProfile';
import { useUserRegistrations } from '../../hooks/useUserRegistrations';
import { useCampRegistration } from '../../hooks/useCampRegistration';
import { useConfig } from '../../store/ConfigContextDefinition';

const mockUseAuth = vi.mocked(useAuth);
const mockUseProfile = vi.mocked(useProfile);
const mockUseUserRegistrations = vi.mocked(useUserRegistrations);
const mockUseCampRegistration = vi.mocked(useCampRegistration);
const mockUseConfig = vi.mocked(useConfig);

// Helper component to wrap with router
const DashboardPageWrapper: React.FC = () => (
  <BrowserRouter>
    <DashboardPage />
  </BrowserRouter>
);

describe('DashboardPage Registration Status', () => {
  const mockUser = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user' as const,
    isAuthenticated: true,
    isEarlyRegistrationEnabled: false,
    hasRegisteredForCurrentYear: false,
  };

  const mockProfile = {
    id: '1',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    playaName: 'TestPlaya',
    phone: '555-0123',
    city: 'Test City',
    stateProvince: 'Test State',
    country: 'Test Country',
    emergencyContact: 'Emergency Contact',
    role: 'PARTICIPANT' as const,
    isEmailVerified: true,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
    isProfileComplete: true,
  };

  beforeEach(() => {
    // Set default mock implementations
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      requestVerificationCode: vi.fn(),
      verifyCode: vi.fn(),
      logout: vi.fn(),
    });

    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      isProfileComplete: true,
      isLoading: false,
      error: null,
      updateProfile: vi.fn(),
    });

    mockUseUserRegistrations.mockReturnValue({
      registrations: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseCampRegistration.mockReturnValue({
      campRegistration: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  describe('Registration Status Messages', () => {
    it('should show registration not open message when both registration and early registration are closed', () => {
      // Setup: Both registration types are closed
      const closedConfig = {
        name: 'Test Camp',
        description: 'Test Description',
        homePageBlurb: 'Test Blurb',
        registrationOpen: false,
        earlyRegistrationOpen: false,
        currentYear: 2025,
      };

      mockUseConfig.mockReturnValue({
        config: closedConfig,
        isLoading: false,
        error: null,
        refreshConfig: vi.fn(),
      });

      render(<DashboardPageWrapper />);

      expect(screen.getByText('Registration for 2025 is not currently open.')).toBeInTheDocument();
      expect(screen.queryByText('Start Registration')).not.toBeInTheDocument();
    });

    it('should show default registration closed message when only early registration is open but user is not eligible', () => {
      // Setup: Early registration is open but user is not eligible
      const earlyOnlyConfig = {
        name: 'Test Camp',
        description: 'Test Description',
        homePageBlurb: 'Test Blurb',
        registrationOpen: false,
        earlyRegistrationOpen: true,
        currentYear: 2025,
      };

      const nonEarlyUser = {
        ...mockUser,
        isEarlyRegistrationEnabled: false,
      };

      mockUseConfig.mockReturnValue({
        config: earlyOnlyConfig,
        isLoading: false,
        error: null,
        refreshConfig: vi.fn(),
      });

      mockUseAuth.mockReturnValue({
        user: nonEarlyUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        requestVerificationCode: vi.fn(),
        verifyCode: vi.fn(),
        logout: vi.fn(),
      });

      render(<DashboardPageWrapper />);

      expect(screen.getByText('Registration for 2025 is not currently open.')).toBeInTheDocument();
      expect(screen.queryByText('Start Registration')).not.toBeInTheDocument();
    });

    it('should show registration button when early registration is open and user is eligible', () => {
      // Setup: Early registration is open and user is eligible
      const earlyOnlyConfig = {
        name: 'Test Camp',
        description: 'Test Description',
        homePageBlurb: 'Test Blurb',
        registrationOpen: false,
        earlyRegistrationOpen: true,
        currentYear: 2025,
      };

      const earlyUser = {
        ...mockUser,
        isEarlyRegistrationEnabled: true,
      };

      mockUseConfig.mockReturnValue({
        config: earlyOnlyConfig,
        isLoading: false,
        error: null,
        refreshConfig: vi.fn(),
      });

      mockUseAuth.mockReturnValue({
        user: earlyUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        requestVerificationCode: vi.fn(),
        verifyCode: vi.fn(),
        logout: vi.fn(),
      });

      render(<DashboardPageWrapper />);

      expect(screen.getByText('Early registration for 2025 is open!')).toBeInTheDocument();
      expect(screen.getByText('Start Registration')).toBeInTheDocument();
    });

    it('should show registration button when general registration is open', () => {
      // Setup: General registration is open
      const openConfig = {
        name: 'Test Camp',
        description: 'Test Description',
        homePageBlurb: 'Test Blurb',
        registrationOpen: true,
        earlyRegistrationOpen: false,
        currentYear: 2025,
      };

      mockUseConfig.mockReturnValue({
        config: openConfig,
        isLoading: false,
        error: null,
        refreshConfig: vi.fn(),
      });

      render(<DashboardPageWrapper />);

      expect(screen.getByText('Registration for 2025 is open!')).toBeInTheDocument();
      expect(screen.getByText('Start Registration')).toBeInTheDocument();
    });
  });

  describe('Welcome Message', () => {
    it('should display playa name when available', () => {
      const openConfig = {
        name: 'Test Camp',
        description: 'Test Description',
        homePageBlurb: 'Test Blurb',
        registrationOpen: true,
        earlyRegistrationOpen: false,
        currentYear: 2025,
      };

      mockUseConfig.mockReturnValue({
        config: openConfig,
        isLoading: false,
        error: null,
        refreshConfig: vi.fn(),
      });

      render(<DashboardPageWrapper />);

      expect(screen.getByText('Welcome, TestPlaya!')).toBeInTheDocument();
    });
  });

  describe('Pending Payments', () => {
    it('should show complete payment button for pending payments', () => {
      const openConfig = {
        name: 'Test Camp',
        description: 'Test Description',
        homePageBlurb: 'Test Blurb',
        registrationOpen: true,
        earlyRegistrationOpen: false,
        currentYear: 2025,
      };

      const registrationWithPendingPayment = {
        id: 'reg-1',
        userId: 'user-1',
        year: 2025,
        status: 'PENDING' as const,
        jobs: [],
        payments: [
          {
            id: 'payment-1',
            amount: 150.00,
            currency: 'USD',
            status: 'PENDING' as const,
            provider: 'STRIPE' as const,
            providerRefId: 'stripe-session-1',
            userId: 'user-1',
            registrationId: 'reg-1',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'payment-2',
            amount: 50.00,
            currency: 'USD',
            status: 'COMPLETED' as const,
            provider: 'STRIPE' as const,
            providerRefId: 'stripe-session-2',
            userId: 'user-1',
            registrationId: 'reg-1',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          }
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      mockUseConfig.mockReturnValue({
        config: openConfig,
        isLoading: false,
        error: null,
        refreshConfig: vi.fn(),
      });

      mockUseUserRegistrations.mockReturnValue({
        registrations: [registrationWithPendingPayment],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<DashboardPageWrapper />);

      // Should show the pending payment section
      expect(screen.getByText('Outstanding Dues')).toBeInTheDocument();
      expect(screen.getByText('You have $150.00 in pending dues')).toBeInTheDocument();
      
      // Should show the payment button
      const paymentButton = screen.getByTestId('payment-button');
      expect(paymentButton).toBeInTheDocument();
      expect(paymentButton).toHaveAttribute('data-amount', '150');
      expect(paymentButton).toHaveTextContent('Complete Dues Payment - $150.00');
    });

    it('should not show complete payment button when no pending payments', () => {
      const openConfig = {
        name: 'Test Camp',
        description: 'Test Description',
        homePageBlurb: 'Test Blurb',
        registrationOpen: true,
        earlyRegistrationOpen: false,
        currentYear: 2025,
      };

      const registrationWithCompletedPayments = {
        id: 'reg-1',
        userId: 'user-1',
        year: 2025,
        status: 'CONFIRMED' as const,
        jobs: [],
        payments: [
          {
            id: 'payment-1',
            amount: 150.00,
            currency: 'USD',
            status: 'COMPLETED' as const,
            provider: 'STRIPE' as const,
            providerRefId: 'stripe-session-3',
            userId: 'user-1',
            registrationId: 'reg-1',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          }
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      mockUseConfig.mockReturnValue({
        config: openConfig,
        isLoading: false,
        error: null,
        refreshConfig: vi.fn(),
      });

      mockUseUserRegistrations.mockReturnValue({
        registrations: [registrationWithCompletedPayments],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<DashboardPageWrapper />);

      // Should not show the pending payment section
      expect(screen.queryByText('Outstanding Dues')).not.toBeInTheDocument();
      expect(screen.queryByTestId('payment-button')).not.toBeInTheDocument();
    });
  });
}); 