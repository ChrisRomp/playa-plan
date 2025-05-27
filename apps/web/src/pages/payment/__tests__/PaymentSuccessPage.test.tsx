import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PaymentSuccessPage from '../PaymentSuccessPage';
import { handleStripeSuccess } from '../../../lib/stripe';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as Record<string, unknown>,
    useSearchParams: vi.fn(),
    useNavigate: vi.fn(),
  };
});

vi.mock('../../../lib/stripe');

const mockNavigate = vi.fn();
const mockSearchParams = {
  get: vi.fn(),
} as unknown as URLSearchParams;

describe('PaymentSuccessPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup react-router-dom mocks
    const { useNavigate, useSearchParams } = await import('react-router-dom');
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useSearchParams).mockReturnValue([mockSearchParams, vi.fn()]);
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <PaymentSuccessPage />
      </MemoryRouter>
    );
  };

  it('should show loading state initially', () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    vi.mocked(handleStripeSuccess).mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderComponent();

    expect(screen.getByText('Processing your payment...')).toBeInTheDocument();
    // Check for loading spinner by class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should show error when no session ID is provided', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue(null);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Error')).toBeInTheDocument();
      expect(screen.getByText('No payment session found')).toBeInTheDocument();
    });
  });

  it('should show success message when payment is completed', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    vi.mocked(handleStripeSuccess).mockResolvedValue({
      paymentStatus: 'COMPLETED',
      registrationId: 'reg_123',
      registrationStatus: 'CONFIRMED',
      paymentId: 'pay_123'
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
      expect(screen.getByText('Your payment has been processed successfully.')).toBeInTheDocument();
      expect(screen.getByText('Your registration is now confirmed!')).toBeInTheDocument();
    });

    expect(handleStripeSuccess).toHaveBeenCalledWith('session_123');
  });

  it('should show processing message when payment is still pending', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    vi.mocked(handleStripeSuccess).mockResolvedValue({
      paymentStatus: 'PENDING',
      registrationId: 'reg_123',
      registrationStatus: 'PENDING',
      paymentId: 'pay_123'
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Processing')).toBeInTheDocument();
      expect(screen.getByText('Your payment is being processed.')).toBeInTheDocument();
      expect(screen.getByText('Current status: PENDING')).toBeInTheDocument();
    });
  });

  it('should show error when payment processing fails', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    const error = new Error('Payment processing failed');
    vi.mocked(handleStripeSuccess).mockRejectedValue(error);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Error')).toBeInTheDocument();
      expect(screen.getByText('Error processing payment confirmation. Please try refreshing the page.')).toBeInTheDocument();
    });
  });

  it('should navigate to dashboard when "View Dashboard" is clicked from success state', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    vi.mocked(handleStripeSuccess).mockResolvedValue({
      paymentStatus: 'COMPLETED',
      registrationId: 'reg_123',
      registrationStatus: 'CONFIRMED',
      paymentId: 'pay_123'
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    const dashboardButton = screen.getByText('View Dashboard');
    fireEvent.click(dashboardButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should only show dashboard button when payment is successful', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    vi.mocked(handleStripeSuccess).mockResolvedValue({
      paymentStatus: 'COMPLETED',
      registrationId: 'reg_123',
      registrationStatus: 'CONFIRMED',
      paymentId: 'pay_123'
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    // Should only have dashboard button, no registration button
    expect(screen.getByText('View Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('View Registration Details')).not.toBeInTheDocument();
  });

  it('should navigate to dashboard from error state', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue(null);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Error')).toBeInTheDocument();
    });

    const dashboardButton = screen.getByText('Go to Dashboard');
    fireEvent.click(dashboardButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should display success UI elements correctly', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    vi.mocked(handleStripeSuccess).mockResolvedValue({
      paymentStatus: 'COMPLETED',
      registrationId: 'reg_123',
      registrationStatus: 'CONFIRMED',
      paymentId: 'pay_123'
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    // Check for success icon (CheckCircleIcon) - it's an SVG element
    const successIcon = document.querySelector('svg.lucide-check-circle');
    expect(successIcon).toBeInTheDocument();

    // Check for action buttons
    expect(screen.getByText('View Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('View Registration Details')).not.toBeInTheDocument();
  });

  it('should display processing UI elements correctly', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    vi.mocked(handleStripeSuccess).mockResolvedValue({
      paymentStatus: 'PENDING',
      registrationId: 'reg_123',
      registrationStatus: 'PENDING',
      paymentId: 'pay_123'
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Processing')).toBeInTheDocument();
    });

    // Check for warning icon (AlertCircleIcon) - it's an SVG element
    const warningIcon = document.querySelector('svg.lucide-alert-circle');
    expect(warningIcon).toBeInTheDocument();

    // Check for dashboard button (registration button should no longer exist)
    expect(screen.getByText('View Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('View Registration Details')).not.toBeInTheDocument();
  });

  it('should display error UI elements correctly', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue(null);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Error')).toBeInTheDocument();
    });

    // Check error styling and button
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  it('should log errors to console when payment processing fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    const error = new Error('Payment processing failed');
    vi.mocked(handleStripeSuccess).mockRejectedValue(error);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Error')).toBeInTheDocument();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error processing payment success:', error);
    consoleSpy.mockRestore();
  });

  it('should show error for 401 errors', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    const error = { response: { status: 401 } };
    vi.mocked(handleStripeSuccess).mockRejectedValue(error);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Error')).toBeInTheDocument();
      expect(screen.getByText('Your session has expired. Please log in again to view your payment status.')).toBeInTheDocument();
    });
  });

  it('should show error for 404 errors', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    const error = { response: { status: 404 } };
    vi.mocked(handleStripeSuccess).mockRejectedValue(error);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Error')).toBeInTheDocument();
      expect(screen.getByText('Payment session not found. Please contact support if you believe this is an error.')).toBeInTheDocument();
    });
  });

  it('should show dashboard button for error types', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    const error = new Error('Payment processing failed');
    vi.mocked(handleStripeSuccess).mockRejectedValue(error);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Error')).toBeInTheDocument();
    });

    const dashboardButton = screen.getByText('Go to Dashboard');
    expect(dashboardButton).toBeInTheDocument();
    expect(dashboardButton).toBeEnabled();
  });

  it('should have proper button styling and accessibility', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    vi.mocked(handleStripeSuccess).mockResolvedValue({
      paymentStatus: 'COMPLETED',
      registrationId: 'reg_123',
      registrationStatus: 'CONFIRMED',
      paymentId: 'pay_123'
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    const dashboardButton = screen.getByText('View Dashboard');

    // Check button classes for proper styling
    expect(dashboardButton).toHaveClass('bg-blue-600', 'text-white');

    // Check that button is accessible
    expect(dashboardButton).toBeVisible();
    
    // Ensure registration button is not present
    expect(screen.queryByText('View Registration Details')).not.toBeInTheDocument();
  });

  it('should handle registration without confirmed status', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    vi.mocked(handleStripeSuccess).mockResolvedValue({
      paymentStatus: 'COMPLETED',
      registrationId: 'reg_123',
      registrationStatus: 'PENDING',
      paymentId: 'pay_123'
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
      expect(screen.getByText('Your registration is being processed and will be confirmed shortly.')).toBeInTheDocument();
    });
  });

  it('should not show registration button when no registration ID is provided', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    vi.mocked(handleStripeSuccess).mockResolvedValue({
      paymentStatus: 'COMPLETED',
      paymentId: 'pay_123'
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    expect(screen.getByText('View Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('View Registration Details')).not.toBeInTheDocument();
  });
}); 