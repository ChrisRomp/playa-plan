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

    await waitFor(() => {
      expect(onPaymentStart).toHaveBeenCalled();
    });
  });

  it('should handle async onPaymentStart callback', async () => {
    const onPaymentStart = vi.fn().mockResolvedValue(undefined);
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

    await waitFor(() => {
      expect(onPaymentStart).toHaveBeenCalled();
      expect(mockProcessStripePayment).toHaveBeenCalled();
    });
  });

  it('should handle onPaymentStart callback error', async () => {
    const onPaymentStart = vi.fn().mockRejectedValue(new Error('Registration failed'));
    const onPaymentError = vi.fn();
    const mockProcessStripePayment = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePayment).mockReturnValue({
      ...mockUsePayment,
      processStripePayment: mockProcessStripePayment,
    });

    render(
      <PaymentButton 
        amount={100} 
        onPaymentStart={onPaymentStart}
        onPaymentError={onPaymentError}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onPaymentStart).toHaveBeenCalled();
      expect(onPaymentError).toHaveBeenCalledWith('Registration failed');
      expect(mockProcessStripePayment).not.toHaveBeenCalled();
    });
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

  // CRITICAL: Test coverage for registration ID scenarios
  describe('Registration ID Handling (CRITICAL for payment-registration association)', () => {
    it('should use registrationId prop when provided', async () => {
      const mockProcessStripePayment = vi.fn().mockResolvedValue(undefined);
      vi.mocked(usePayment).mockReturnValue({
        ...mockUsePayment,
        processStripePayment: mockProcessStripePayment,
      });

      render(
        <PaymentButton 
          amount={100} 
          registrationId="reg-prop-123"
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockProcessStripePayment).toHaveBeenCalledWith({
          amount: 100,
          registrationId: 'reg-prop-123',
          description: undefined,
        });
      });
    });

    it('should use registrationId from onPaymentStart return value when provided', async () => {
      const mockProcessStripePayment = vi.fn().mockResolvedValue(undefined);
      const onPaymentStart = vi.fn().mockResolvedValue({ registrationId: 'reg-from-callback-456' });

      vi.mocked(usePayment).mockReturnValue({
        ...mockUsePayment,
        processStripePayment: mockProcessStripePayment,
      });

      render(
        <PaymentButton 
          amount={100} 
          registrationId="reg-prop-123"
          onPaymentStart={onPaymentStart}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onPaymentStart).toHaveBeenCalled();
        expect(mockProcessStripePayment).toHaveBeenCalledWith({
          amount: 100,
          registrationId: 'reg-from-callback-456', // Should use callback value, not prop
          description: undefined,
        });
      });
    });

    it('should fallback to prop registrationId when onPaymentStart returns undefined registrationId', async () => {
      const mockProcessStripePayment = vi.fn().mockResolvedValue(undefined);
      const onPaymentStart = vi.fn().mockResolvedValue({ registrationId: undefined });

      vi.mocked(usePayment).mockReturnValue({
        ...mockUsePayment,
        processStripePayment: mockProcessStripePayment,
      });

      render(
        <PaymentButton 
          amount={100} 
          registrationId="reg-prop-fallback"
          onPaymentStart={onPaymentStart}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockProcessStripePayment).toHaveBeenCalledWith({
          amount: 100,
          registrationId: 'reg-prop-fallback', // Should fallback to prop value
          description: undefined,
        });
      });
    });

    it('should handle onPaymentStart returning void without breaking registrationId', async () => {
      const mockProcessStripePayment = vi.fn().mockResolvedValue(undefined);
      const onPaymentStart = vi.fn().mockResolvedValue(undefined);

      vi.mocked(usePayment).mockReturnValue({
        ...mockUsePayment,
        processStripePayment: mockProcessStripePayment,
      });

      render(
        <PaymentButton 
          amount={100} 
          registrationId="reg-prop-void-test"
          onPaymentStart={onPaymentStart}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockProcessStripePayment).toHaveBeenCalledWith({
          amount: 100,
          registrationId: 'reg-prop-void-test', // Should still use prop value
          description: undefined,
        });
      });
    });

    it('should handle missing registrationId gracefully (but this is a critical issue)', async () => {
      const mockProcessStripePayment = vi.fn().mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.mocked(usePayment).mockReturnValue({
        ...mockUsePayment,
        processStripePayment: mockProcessStripePayment,
      });

      render(<PaymentButton amount={100} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockProcessStripePayment).toHaveBeenCalledWith({
          amount: 100,
          registrationId: undefined, // This would be a critical issue in production
          description: undefined,
        });
      });

      consoleSpy.mockRestore();
    });

    it('should not proceed with payment if onPaymentStart throws error', async () => {
      const mockProcessStripePayment = vi.fn();
      const onPaymentStart = vi.fn().mockRejectedValue(new Error('Registration creation failed'));
      const onPaymentError = vi.fn();

      vi.mocked(usePayment).mockReturnValue({
        ...mockUsePayment,
        processStripePayment: mockProcessStripePayment,
      });

      render(
        <PaymentButton 
          amount={100} 
          onPaymentStart={onPaymentStart}
          onPaymentError={onPaymentError}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onPaymentStart).toHaveBeenCalled();
        expect(onPaymentError).toHaveBeenCalledWith('Registration creation failed');
        expect(mockProcessStripePayment).not.toHaveBeenCalled(); // Should not proceed to payment
      });
    });
  });
}); 