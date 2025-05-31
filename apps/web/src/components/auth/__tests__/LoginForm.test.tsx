import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, Mock } from 'vitest';
import LoginForm from '../LoginForm';
import { useAuth } from '../../../store/authUtils';

// Mock the useAuth hook
vi.mock('../../../store/authUtils', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = useAuth as Mock;

describe('LoginForm - Button State Management', () => {
  const defaultAuthContextValue = {
    requestVerificationCode: vi.fn().mockResolvedValue(false),
    verifyCode: vi.fn(),
    error: null,
    isAuthenticated: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuthContextValue);
  });

  it('should reset button to normal state when verification fails', async () => {
    // Mock requestVerificationCode to succeed and verifyCode to reject with an error
    const mockRequestVerificationCode = vi.fn().mockResolvedValue(true);
    const mockVerifyCode = vi.fn().mockRejectedValue(new Error('Invalid verification code'));
    
    mockUseAuth.mockReturnValue({
      ...defaultAuthContextValue,
      requestVerificationCode: mockRequestVerificationCode,
      verifyCode: mockVerifyCode,
    });

    render(<LoginForm />);

    // First, simulate sending verification code
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    const sendCodeButton = screen.getByText('Send Verification Code');
    fireEvent.click(sendCodeButton);

    // Wait for the verification code input to appear
    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    // Enter a verification code
    const codeInput = screen.getByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });

    // Find the Log In button
    const loginButton = screen.getByRole('button', { name: /log in/i });
    
    // Click the Log In button
    fireEvent.click(loginButton);

    // The button should show "Verifying..." immediately
    await waitFor(() => {
      expect(screen.getByText('Verifying...')).toBeInTheDocument();
    });

    // Wait for the error to appear and button to return to normal state
    await waitFor(() => {
      expect(screen.getByText('Error:')).toBeInTheDocument();
    });

    // Critical test: The button should return to "Log In" state and be enabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
    });

    // Verify the button text is back to "Log In" (not "Verifying...")
    expect(screen.getByRole('button', { name: /log in/i })).toHaveTextContent('Log In');
  });

  it('should reset button state when AuthContext error changes', async () => {
    // Start with no error
    const mockRequestVerificationCode = vi.fn().mockResolvedValue(true);
    const mockVerifyCode = vi.fn().mockRejectedValue(new Error('API Error'));
    
    mockUseAuth.mockReturnValue({
      ...defaultAuthContextValue,
      requestVerificationCode: mockRequestVerificationCode,
      verifyCode: mockVerifyCode,
      error: null,
    });

    const { rerender } = render(<LoginForm />);

    // Simulate sending code and entering verification
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send Verification Code'));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    const codeInput = screen.getByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });

    // Click verify - this should fail and show loading
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Verifying...')).toBeInTheDocument();
    });

    // Now simulate AuthContext error changing
    mockUseAuth.mockReturnValue({
      ...defaultAuthContextValue,
      requestVerificationCode: mockRequestVerificationCode,
      verifyCode: mockVerifyCode,
      error: 'Invalid verification code from AuthContext',
    });

    rerender(<LoginForm />);

    // The button should be reset due to the useEffect watching authError
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
    });
  });
});