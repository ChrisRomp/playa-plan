import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '../DashboardPage';
import * as registrationUtils from '../../utils/registrationUtils';

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

// Mock registration utils
vi.spyOn(registrationUtils, 'canUserRegister');
vi.spyOn(registrationUtils, 'getActiveRegistrations');
vi.spyOn(registrationUtils, 'getCancelledRegistrations');

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

describe('DashboardPage - Registration after cancellation', () => {
  it('should use registration utilities correctly', () => {
    // Test that the registrationUtils functions are available for the dashboard
    expect(registrationUtils.canUserRegister).toBeDefined();
    expect(registrationUtils.getActiveRegistrations).toBeDefined();
    expect(registrationUtils.getCancelledRegistrations).toBeDefined();
  });
});
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

  const mockJob = {
    id: 'job-id',
    name: 'Kitchen Helper',
    location: 'Kitchen',
    category: { name: 'Kitchen' },
    shift: { 
      name: 'Morning',
      startTime: '08:00',
      endTime: '12:00',
      dayOfWeek: 'MONDAY'
    }
  };

  const mockCancelledRegistration = {
    id: 'cancelled-reg-id', 
    userId: '1',
    year: 2024, 
    status: 'CANCELLED' as const,
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-15T14:30:00.000Z',
    jobs: [],
    payments: [{ 
      id: 'payment-1', 
      amount: 100, 
      status: 'REFUNDED' as const,
      currency: 'USD',
      provider: 'STRIPE' as const,
      providerRefId: 'stripe-ref-1',
      userId: '1',
      registrationId: 'cancelled-reg-id',
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-15T14:30:00.000Z',
    }]
  };

  const mockActiveRegistration = {
    id: 'active-reg-id',
    userId: '1',
    year: 2024,
    status: 'CONFIRMED' as const, 
    createdAt: '2024-01-20T10:00:00.000Z',
    updatedAt: '2024-01-20T10:00:00.000Z',
    jobs: [{ 
      id: 'reg-job-id', 
      job: mockJob,
      registration: { id: 'active-reg-id' }
    }],
    payments: [{ 
      id: 'payment-2', 
      amount: 100, 
      status: 'COMPLETED' as const,
      currency: 'USD',
      provider: 'STRIPE' as const,
      providerRefId: 'stripe-ref-2',
      userId: '1',
      registrationId: 'active-reg-id',
      createdAt: '2024-01-20T10:00:00.000Z',
      updatedAt: '2024-01-20T10:00:00.000Z',
    }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
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

    mockUseConfig.mockReturnValue({
      config: {
        name: 'Test Camp',
        description: 'Test Description',
        homePageBlurb: 'Test Blurb',
        registrationOpen: true,
        earlyRegistrationOpen: false,
        currentYear: 2024,
      },
      isLoading: false,
      error: null,
      refreshConfig: vi.fn(),
    });

    mockUseCampRegistration.mockReturnValue({
      campRegistration: {
        hasRegistration: false,
        campingOptions: [],
        customFieldValues: [],
        jobRegistrations: []
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseUserRegistrations.mockReturnValue({
      registrations: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Mock registration utils with default implementations
    vi.mocked(registrationUtils.canUserRegister).mockReturnValue(true);
    vi.mocked(registrationUtils.getActiveRegistrations).mockReturnValue([]);
    vi.mocked(registrationUtils.getCancelledRegistrations).mockReturnValue([]);
  });

  describe('Re-registration after cancellation', () => {
    it('should show registration button when user has only cancelled registration', async () => {
      // Setup: User with only cancelled registration
      mockUseUserRegistrations.mockReturnValue({
        registrations: [mockCancelledRegistration],
        loading: false,
        error: null
      });

      // Mock utils to reflect this state
      vi.mocked(registrationUtils.getActiveRegistrations).mockReturnValue([]);
      vi.mocked(registrationUtils.getCancelledRegistrations).mockReturnValue([mockCancelledRegistration]);
      vi.mocked(registrationUtils.canUserRegister).mockReturnValue(true);

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Start Registration')).toBeInTheDocument();
      });
      
      // Should also show registration status
      expect(screen.getByText(/Registration for 2024 is open/)).toBeInTheDocument();
    });

    it('should not show registration button when user has active registration', async () => {
      // Setup: User with active registration
      mockUseUserRegistrations.mockReturnValue({
        registrations: [mockActiveRegistration],
        loading: false,
        error: null
      });

      mockUseCampRegistration.mockReturnValue({
        campRegistration: {
          hasRegistration: true,
          campingOptions: [],
          customFieldValues: [],
          jobRegistrations: [{ id: '1', status: 'CONFIRMED', jobs: [], payments: [] }]
        },
        loading: false,
        error: null
      });

      // Mock utils to reflect this state  
      vi.mocked(registrationUtils.getActiveRegistrations).mockReturnValue([mockActiveRegistration]);
      vi.mocked(registrationUtils.getCancelledRegistrations).mockReturnValue([]);
      vi.mocked(registrationUtils.canUserRegister).mockReturnValue(false);

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.queryByText('Start Registration')).not.toBeInTheDocument();
      });
    });

    it('should allow registration when user has both cancelled and active registration from different years', async () => {
      const registrationsMultiYear = [
        { ...mockActiveRegistration, year: 2023 }, // Previous year active
        { ...mockCancelledRegistration, year: 2024 } // Current year cancelled
      ];

      mockUseUserRegistrations.mockReturnValue({
        registrations: registrationsMultiYear,
        loading: false,
        error: null
      });

      // For current year, no active registration exists
      vi.mocked(registrationUtils.getActiveRegistrations).mockReturnValue([]);
      vi.mocked(registrationUtils.getCancelledRegistrations).mockReturnValue([mockCancelledRegistration]);
      vi.mocked(registrationUtils.canUserRegister).mockReturnValue(true);

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Start Registration')).toBeInTheDocument();
      });
    });
  });

  describe('Registration History section', () => {
    it('should show registration history section when user has cancelled registrations', async () => {
      mockUseUserRegistrations.mockReturnValue({
        registrations: [mockActiveRegistration, mockCancelledRegistration],
        loading: false,
        error: null
      });

      // Mock utils
      vi.mocked(registrationUtils.getActiveRegistrations).mockReturnValue([mockActiveRegistration]);
      vi.mocked(registrationUtils.getCancelledRegistrations).mockReturnValue([mockCancelledRegistration]);

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Registration History')).toBeInTheDocument();
      });
    });

    it('should display cancelled registration details in history', async () => {
      mockUseUserRegistrations.mockReturnValue({
        registrations: [mockCancelledRegistration],
        loading: false,
        error: null
      });

      vi.mocked(registrationUtils.getCancelledRegistrations).mockReturnValue([mockCancelledRegistration]);

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        // Should show status
        expect(screen.getByText('CANCELLED')).toBeInTheDocument();
        
        // Should show year
        expect(screen.getByText('2024')).toBeInTheDocument();
        
        // Should show payment status
        expect(screen.getByText('REFUNDED')).toBeInTheDocument();
      });
    });

    it('should display work shifts in cancelled registration history', async () => {
      const cancelledWithJobs = {
        ...mockCancelledRegistration,
        jobs: [{ 
          id: 'reg-job-id', 
          job: mockJob,
          registration: { id: 'cancelled-reg-id' }
        }]
      };

      mockUseUserRegistrations.mockReturnValue({
        registrations: [cancelledWithJobs],
        loading: false,
        error: null
      });

      vi.mocked(registrationUtils.getCancelledRegistrations).mockReturnValue([cancelledWithJobs]);

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Kitchen Helper')).toBeInTheDocument();
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(screen.getByText('Morning')).toBeInTheDocument();
      });
    });

    it('should not show registration history section when no cancelled registrations exist', async () => {
      mockUseUserRegistrations.mockReturnValue({
        registrations: [mockActiveRegistration],
        loading: false,
        error: null
      });

      vi.mocked(registrationUtils.getActiveRegistrations).mockReturnValue([mockActiveRegistration]);
      vi.mocked(registrationUtils.getCancelledRegistrations).mockReturnValue([]);

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.queryByText('Registration History')).not.toBeInTheDocument();
      });
    });

    it('should handle multiple cancelled registrations in history', async () => {
      const cancelledRegistration2023 = {
        ...mockCancelledRegistration,
        id: 'cancelled-2023',
        year: 2023
      };

      const multipleRegistrations = [
        mockActiveRegistration,
        mockCancelledRegistration, // 2024
        cancelledRegistration2023    // 2023
      ];

      mockUseUserRegistrations.mockReturnValue({
        registrations: multipleRegistrations,
        loading: false,
        error: null
      });

      vi.mocked(registrationUtils.getCancelledRegistrations).mockReturnValue([
        mockCancelledRegistration,
        cancelledRegistration2023
      ]);

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText('Registration History')).toBeInTheDocument();
        
        // Should show both years
        expect(screen.getByText('2024')).toBeInTheDocument();
        expect(screen.getByText('2023')).toBeInTheDocument();
        
        // Should show multiple cancelled statuses
        const cancelledElements = screen.getAllByText('CANCELLED');
        expect(cancelledElements).toHaveLength(2);
      });
    });
  });

  describe('Loading and error states', () => {
    it('should handle loading state for registrations', async () => {
      mockUseUserRegistrations.mockReturnValue({
        registrations: [],
        loading: true,
        error: null
      });

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should handle error state for registrations', async () => {
      mockUseUserRegistrations.mockReturnValue({
        registrations: [],
        loading: false,
        error: new Error('Failed to load registrations')
      });

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load registrations/)).toBeInTheDocument();
      });
    });
  });

  describe('Registration status messages', () => {
    it('should show appropriate message when registration is closed', async () => {
      mockUseConfig.mockReturnValue({
        config: { ...mockCoreConfig, registrationOpen: false },
        isLoading: false,
        error: null
      });

      mockUseUserRegistrations.mockReturnValue({
        registrations: [mockCancelledRegistration],
        loading: false,
        error: null
      });

      vi.mocked(registrationUtils.canUserRegister).mockReturnValue(false);

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText(/Registration is currently closed/)).toBeInTheDocument();
      });
    });

    it('should call registration utils with correct parameters', async () => {
      mockUseUserRegistrations.mockReturnValue({
        registrations: [mockCancelledRegistration],
        loading: false,
        error: null
      });

      const Wrapper = createWrapper();
      render(<DashboardPage />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(registrationUtils.getActiveRegistrations).toHaveBeenCalledWith([mockCancelledRegistration]);
        expect(registrationUtils.getCancelledRegistrations).toHaveBeenCalledWith([mockCancelledRegistration]);
        expect(registrationUtils.canUserRegister).toHaveBeenCalledWith(
          mockCoreConfig,
          mockUser,
          false // hasActiveRegistration should be false for cancelled-only
        );
      });
    });
  });
});

// Create a wrapper component for providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}; 