import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePayment } from '../usePayment';
import { redirectToStripeCheckout } from '../../lib/stripe';
import { AuthContext } from '../../store/authUtils';
import { ConfigContext } from '../../store/ConfigContextDefinition';

// Mock dependencies
vi.mock('../../lib/stripe');

// Mock data
const mockConfig = {
  stripeEnabled: true,
  stripePublicKey: 'pk_test_123',
  paypalEnabled: false,
  paypalClientId: '',
  name: 'Test Camp',
  description: 'Test Description',
  homePageBlurb: 'Test Blurb',
  registrationOpen: true,
  earlyRegistrationOpen: false,
  currentYear: 2024,
};

const mockUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user' as const,
  isAuthenticated: true,
  isEarlyRegistrationEnabled: false,
  hasRegisteredForCurrentYear: false,
};

const mockAuthContext = {
  user: mockUser,
  isLoading: false,
  error: null,
  isAuthenticated: true,
  requestVerificationCode: vi.fn(),
  verifyCode: vi.fn(),
  logout: vi.fn(),
};

const mockConfigContext = {
  config: mockConfig,
  isLoading: false,
  error: null,
  refreshConfig: vi.fn(),
};

// Mock window.location
const mockLocation = {
  origin: 'http://localhost:3000',
} as Location;
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('usePayment', () => {
  const mockRedirectToStripeCheckout = vi.mocked(redirectToStripeCheckout);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = (authOverrides = {}, configOverrides = {}) => {
    const authValue = { ...mockAuthContext, ...authOverrides };
    const configValue = { ...mockConfigContext, ...configOverrides };

    return ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={authValue}>
        <ConfigContext.Provider value={configValue}>
          {children}
        </ConfigContext.Provider>
      </AuthContext.Provider>
    );
  };

  it('should initialize with default state', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePayment(), { wrapper });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isPaymentAvailable()).toBe(true);
    expect(result.current.isStripeAvailable()).toBe(true);
    expect(result.current.isPayPalAvailable()).toBe(false);
  });

  describe('processStripePayment', () => {
    it('should process Stripe payment successfully', async () => {
      mockRedirectToStripeCheckout.mockResolvedValue();
      const wrapper = createWrapper();

      const { result } = renderHook(() => usePayment(), { wrapper });

      await act(async () => {
        await result.current.processStripePayment({
          amount: 100,
          registrationId: 'reg-123',
          description: 'Test payment',
        });
      });

      expect(mockRedirectToStripeCheckout).toHaveBeenCalledWith('pk_test_123', {
        amount: 10000, // $100 in cents
        currency: 'USD',
        userId: 'user-123',
        registrationId: 'reg-123',
        description: 'Test payment',
        successUrl: 'http://localhost:3000/payment/success.html?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'http://localhost:3000/payment/cancel.html',
      });
      expect(result.current.error).toBeNull();
      expect(result.current.isProcessing).toBe(false);
    });

    it('should handle missing user', async () => {
      const wrapper = createWrapper({ user: null });
      const { result } = renderHook(() => usePayment(), { wrapper });

      await expect(
        act(async () => {
          await result.current.processStripePayment({
            amount: 100,
          });
        })
      ).rejects.toThrow('User must be logged in to make payment');
    });

    it('should handle Stripe not configured', async () => {
      const wrapper = createWrapper({}, {
        config: {
          ...mockConfig,
          stripeEnabled: false,
          stripePublicKey: '',
        }
      });

      const { result } = renderHook(() => usePayment(), { wrapper });

      await expect(
        act(async () => {
          await result.current.processStripePayment({
            amount: 100,
          });
        })
      ).rejects.toThrow('Stripe payments are not configured');

      await waitFor(() => {
        expect(result.current.error).toBe('Stripe payments are not configured');
      }, { timeout: 5000 });
    });

    it('should handle payment errors', async () => {
      const paymentError = new Error('Payment failed');
      mockRedirectToStripeCheckout.mockRejectedValue(paymentError);
      const wrapper = createWrapper();

      const { result } = renderHook(() => usePayment(), { wrapper });

      await expect(
        act(async () => {
          await result.current.processStripePayment({
            amount: 100,
          });
        })
      ).rejects.toThrow('Payment failed');

      await waitFor(() => {
        expect(result.current.error).toBe('Payment failed');
      }, { timeout: 5000 });
      expect(result.current.isProcessing).toBe(false);
    });

    it('should set processing state during payment', async () => {
      let resolvePayment: () => void;
      const paymentPromise = new Promise<void>((resolve) => {
        resolvePayment = resolve;
      });
      mockRedirectToStripeCheckout.mockReturnValue(paymentPromise);
      const wrapper = createWrapper();

      const { result } = renderHook(() => usePayment(), { wrapper });

      act(() => {
        result.current.processStripePayment({
          amount: 100,
        });
      });

      expect(result.current.isProcessing).toBe(true);

      await act(async () => {
        resolvePayment();
        await paymentPromise;
      });

      expect(result.current.isProcessing).toBe(false);
    });

    it('should convert amount to cents correctly', async () => {
      mockRedirectToStripeCheckout.mockResolvedValue();
      const wrapper = createWrapper();

      const { result } = renderHook(() => usePayment(), { wrapper });

      await act(async () => {
        await result.current.processStripePayment({
          amount: 123.45,
        });
      });

      expect(mockRedirectToStripeCheckout).toHaveBeenCalledWith('pk_test_123', {
        amount: 12345, // $123.45 in cents
        currency: 'USD',
        userId: 'user-123',
        description: 'Camp registration payment',
        successUrl: 'http://localhost:3000/payment/success.html?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'http://localhost:3000/payment/cancel.html',
      });
    });
  });

  describe('processPayPalPayment', () => {
    it('should throw error for unimplemented PayPal', async () => {
      const wrapper = createWrapper({}, {
        config: {
          ...mockConfig,
          paypalEnabled: true,
          paypalClientId: 'paypal-client-123',
        }
      });

      const { result } = renderHook(() => usePayment(), { wrapper });

      await expect(
        act(async () => {
          await result.current.processPayPalPayment({
            amount: 100,
          });
        })
      ).rejects.toThrow('PayPal payments not yet implemented');

      await waitFor(() => {
        expect(result.current.error).toBe('PayPal payments not yet implemented');
      }, { timeout: 5000 });
    });

    it('should handle PayPal not configured', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePayment(), { wrapper });

      await expect(
        act(async () => {
          await result.current.processPayPalPayment({
            amount: 100,
          });
        })
      ).rejects.toThrow('PayPal payments are not configured');
    });
  });

  describe('payment availability checks', () => {
    it('should check Stripe availability', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePayment(), { wrapper });

      expect(result.current.isStripeAvailable()).toBe(true);

      // Test with Stripe disabled
      const wrapperDisabled = createWrapper({}, {
        config: { ...mockConfig, stripeEnabled: false },
      });

      const { result: result2 } = renderHook(() => usePayment(), { wrapper: wrapperDisabled });
      expect(result2.current.isStripeAvailable()).toBe(false);
    });

    it('should check PayPal availability', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePayment(), { wrapper });

      expect(result.current.isPayPalAvailable()).toBe(false);

      // Test with PayPal enabled
      const wrapperPayPal = createWrapper({}, {
        config: {
          ...mockConfig,
          paypalEnabled: true,
          paypalClientId: 'paypal-client-123',
        },
      });

      const { result: result2 } = renderHook(() => usePayment(), { wrapper: wrapperPayPal });
      expect(result2.current.isPayPalAvailable()).toBe(true);
    });

    it('should check overall payment availability', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePayment(), { wrapper });

      expect(result.current.isPaymentAvailable()).toBe(true);

      // Test with no payment methods enabled
      const wrapperNone = createWrapper({}, {
        config: {
          ...mockConfig,
          stripeEnabled: false,
          paypalEnabled: false,
        },
      });

      const { result: result2 } = renderHook(() => usePayment(), { wrapper: wrapperNone });
      expect(result2.current.isPaymentAvailable()).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      const paymentError = new Error('Payment failed');
      mockRedirectToStripeCheckout.mockRejectedValue(paymentError);
      const wrapper = createWrapper();

      const { result } = renderHook(() => usePayment(), { wrapper });

      // Create an error
      await expect(
        act(async () => {
          await result.current.processStripePayment({ amount: 100 });
        })
      ).rejects.toThrow('Payment failed');

      await waitFor(() => {
        expect(result.current.error).toBe('Payment failed');
      }, { timeout: 5000 });

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
}); 