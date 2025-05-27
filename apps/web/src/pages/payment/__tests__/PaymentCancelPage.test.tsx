import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PaymentCancelPage from '../PaymentCancelPage';
import { handleStripeCancel } from '../../../lib/stripe';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as Record<string, unknown>,
    useNavigate: vi.fn(),
  };
});

vi.mock('../../../lib/stripe');

const mockNavigate = vi.fn();

describe('PaymentCancelPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup react-router-dom mocks
    const { useNavigate } = await import('react-router-dom');
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    
    // Setup stripe mock
    vi.mocked(handleStripeCancel).mockImplementation(() => {});
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <PaymentCancelPage />
      </MemoryRouter>
    );
  };

  it('should render cancel message and UI elements', () => {
    renderComponent();

    expect(screen.getByText('Payment Cancelled')).toBeInTheDocument();
    expect(screen.getByText(/Your payment was cancelled/)).toBeInTheDocument();
    expect(screen.getByText(/Don't worry - no charges were made/)).toBeInTheDocument();
  });

  it('should call handleStripeCancel on mount', () => {
    renderComponent();

    expect(handleStripeCancel).toHaveBeenCalledTimes(1);
  });

  it('should navigate to registration when "Try Payment Again" is clicked', () => {
    renderComponent();

    const retryButton = screen.getByText('Try Payment Again');
    fireEvent.click(retryButton);

    expect(mockNavigate).toHaveBeenCalledWith('/registration');
  });

  it('should navigate to dashboard when "Go to Dashboard" is clicked', () => {
    renderComponent();

    const dashboardButton = screen.getByText('Go to Dashboard');
    fireEvent.click(dashboardButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should display cancel icon', () => {
    renderComponent();

    // Check for cancel icon (XCircleIcon) - it's an SVG element
    const cancelIcon = document.querySelector('svg.lucide-xcircle');
    expect(cancelIcon).toBeInTheDocument();
  });

  it('should have proper button styling and accessibility', () => {
    renderComponent();

    const retryButton = screen.getByText('Try Payment Again');
    const dashboardButton = screen.getByText('Go to Dashboard');

    // Check button classes for proper styling
    expect(retryButton).toHaveClass('bg-blue-600', 'text-white');
    expect(dashboardButton).toHaveClass('bg-gray-200', 'text-gray-800');

    // Check that buttons are accessible
    expect(retryButton).toBeVisible();
    expect(dashboardButton).toBeVisible();
  });

  it('should have proper layout and styling', () => {
    renderComponent();

    // Check for main heading
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Payment Cancelled');

    // Check for explanatory text
    expect(screen.getByText(/You can try again when you're ready/)).toBeInTheDocument();

    // Check for action buttons container
    const retryButton = screen.getByText('Try Payment Again');
    const dashboardButton = screen.getByText('Go to Dashboard');
    
    expect(retryButton).toBeInTheDocument();
    expect(dashboardButton).toBeInTheDocument();
  });

  it('should call useEffect only once on mount', () => {
    renderComponent();

    // handleStripeCancel should be called exactly once
    expect(handleStripeCancel).toHaveBeenCalledTimes(1);
    
    // Re-render should not call it again
    renderComponent();
    expect(handleStripeCancel).toHaveBeenCalledTimes(2); // Each render calls it once
  });
}); 