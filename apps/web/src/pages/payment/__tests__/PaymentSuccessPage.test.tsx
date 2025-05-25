import React from 'react';
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
    
    // Setup stripe mock
    vi.mocked(handleStripeSuccess).mockResolvedValue();
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

  it('should show success message when payment is processed', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
      expect(screen.getByText('Your payment has been processed successfully. Your registration is now confirmed.')).toBeInTheDocument();
    });

    expect(handleStripeSuccess).toHaveBeenCalledWith('session_123');
  });

  it('should show error when payment processing fails', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    const error = new Error('Payment processing failed');
    vi.mocked(handleStripeSuccess).mockRejectedValue(error);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Error')).toBeInTheDocument();
      expect(screen.getByText('Error processing payment confirmation')).toBeInTheDocument();
    });
  });

  it('should navigate to dashboard when "View Dashboard" is clicked', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    const dashboardButton = screen.getByText('View Dashboard');
    fireEvent.click(dashboardButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should navigate to registration when "View Registration Details" is clicked', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    const registrationButton = screen.getByText('View Registration Details');
    fireEvent.click(registrationButton);

    expect(mockNavigate).toHaveBeenCalledWith('/registration');
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
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    // Check for success icon (CheckCircleIcon) - it's an SVG element
    const successIcon = document.querySelector('svg.lucide-check-circle');
    expect(successIcon).toBeInTheDocument();

    // Check for action buttons
    expect(screen.getByText('View Dashboard')).toBeInTheDocument();
    expect(screen.getByText('View Registration Details')).toBeInTheDocument();
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

  it('should have proper button styling and accessibility', async () => {
    vi.mocked(mockSearchParams.get).mockReturnValue('session_123');
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
    });

    const dashboardButton = screen.getByText('View Dashboard');
    const registrationButton = screen.getByText('View Registration Details');

    // Check button classes for proper styling
    expect(dashboardButton).toHaveClass('bg-blue-600', 'text-white');
    expect(registrationButton).toHaveClass('bg-gray-200', 'text-gray-800');

    // Check that buttons are accessible
    expect(dashboardButton).toBeVisible();
    expect(registrationButton).toBeVisible();
  });
}); 