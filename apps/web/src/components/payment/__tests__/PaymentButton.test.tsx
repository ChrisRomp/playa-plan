import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentButton from '../PaymentButton';
import { usePayment } from '../../../hooks/usePayment';

// Mock the usePayment hook
vi.mock('../../../hooks/usePayment');

const mockUsePayment = {
  isProcessing: false,
  error: null,
  processStripePayment: vi.fn(),
  processPayPalPayment: vi.fn(),
  isPaymentAvailable: vi.fn(() => true),
  isStripeAvailable: vi.fn(() => true),
  isPayPalAvailable: vi.fn(() => false),
  clearError: vi.fn(),
};

describe('PaymentButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePayment).mockReturnValue(mockUsePayment);
  });

  it('should render with default props', () => {
    render(<PaymentButton amount={100} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Pay $100.00');
    expect(button).not.toBeDisabled();
  });

  it('should render with custom children', () => {
    render(
      <PaymentButton amount={50}>
        Custom Payment Text
      </PaymentButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Custom Payment Text');
  });

  it('should display amount correctly', () => {
    render(<PaymentButton amount={123.45} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Pay $123.45');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<PaymentButton amount={100} disabled />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when processing', () => {
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      isProcessing: true,
    });

    render(<PaymentButton amount={100} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Processing...');
  });

  it('should be disabled when Stripe is not available', () => {
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      isStripeAvailable: vi.fn(() => false),
    });

    render(<PaymentButton amount={100} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    expect(screen.getByText('Payment processing is not currently available. Please contact camp administrators.')).toBeInTheDocument();
  });

  it('should display error when payment hook has error', () => {
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      error: 'Payment failed',
    });

    render(<PaymentButton amount={100} />);

    expect(screen.getByText('Payment failed')).toBeInTheDocument();
  });

  it('should call processStripePayment on click', async () => {
    const mockProcessStripePayment = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      processStripePayment: mockProcessStripePayment,
    });

    render(
      <PaymentButton 
        amount={100} 
        registrationId="reg-123"
        description="Test payment"
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockProcessStripePayment).toHaveBeenCalledWith({
        amount: 100,
        registrationId: 'reg-123',
        description: 'Test payment',
      });
    });
  });

  it('should call onPaymentStart callback', async () => {
    const onPaymentStart = vi.fn();
    const mockProcessStripePayment = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      processStripePayment: mockProcessStripePayment,
    });

    render(
      <PaymentButton 
        amount={100} 
        onPaymentStart={onPaymentStart}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onPaymentStart).toHaveBeenCalled();
  });

  it('should call onPaymentError callback on payment failure', async () => {
    const onPaymentError = vi.fn();
    const mockProcessStripePayment = vi.fn().mockRejectedValue(new Error('Payment failed'));
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      processStripePayment: mockProcessStripePayment,
    });

    render(
      <PaymentButton 
        amount={100} 
        onPaymentError={onPaymentError}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onPaymentError).toHaveBeenCalledWith('Payment failed');
    });
  });

  it('should handle payment error when Stripe is not available', async () => {
    const onPaymentError = vi.fn();
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      isStripeAvailable: vi.fn(() => false),
    });

    render(
      <PaymentButton 
        amount={100} 
        onPaymentError={onPaymentError}
      />
    );

    const button = screen.getByRole('button');
    
    // Button should be disabled when Stripe is not available
    expect(button).toBeDisabled();
    
    // Should show error message
    expect(screen.getByText('Payment processing is not currently available. Please contact camp administrators.')).toBeInTheDocument();
  });

  it('should clear error on click', async () => {
    const mockClearError = vi.fn();
    const mockProcessStripePayment = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      processStripePayment: mockProcessStripePayment,
      clearError: mockClearError,
    });

    render(<PaymentButton amount={100} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockClearError).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<PaymentButton amount={100} className="custom-class" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should show loading icon when processing', () => {
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      isProcessing: true,
    });

    render(<PaymentButton amount={100} />);

    // Check for loading spinner (Loader2Icon)
    const spinner = screen.getByRole('button').querySelector('svg');
    expect(spinner).toBeInTheDocument();
  });

  it('should show credit card icon when not processing', () => {
    render(<PaymentButton amount={100} />);

    // Check for credit card icon (CreditCardIcon)
    const icon = screen.getByRole('button').querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should handle non-Error exceptions', async () => {
    const onPaymentError = vi.fn();
    const mockProcessStripePayment = vi.fn().mockRejectedValue('String error');
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      processStripePayment: mockProcessStripePayment,
    });

    render(
      <PaymentButton 
        amount={100} 
        onPaymentError={onPaymentError}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onPaymentError).toHaveBeenCalledWith('Payment failed');
    });
  });

  it('should not call processStripePayment when disabled', async () => {
    const mockProcessStripePayment = vi.fn();
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      processStripePayment: mockProcessStripePayment,
    });

    render(<PaymentButton amount={100} disabled />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockProcessStripePayment).not.toHaveBeenCalled();
  });

  it('should not call processStripePayment when processing', async () => {
    const mockProcessStripePayment = vi.fn();
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      isProcessing: true,
      processStripePayment: mockProcessStripePayment,
    });

    render(<PaymentButton amount={100} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockProcessStripePayment).not.toHaveBeenCalled();
  });
}); 