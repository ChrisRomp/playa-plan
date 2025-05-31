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

  it('should handle wrong verification code with proper error message', async () => {
    // Mock the exact scenario that was failing: wrong verification code returns 401
    const mockRequestVerificationCode = vi.fn().mockResolvedValue(true);
    const mockVerifyCode = vi.fn().mockRejectedValue(new Error('Invalid or expired verification code'));
    
    mockUseAuth.mockReturnValue({
      ...defaultAuthContextValue,
      requestVerificationCode: mockRequestVerificationCode,
      verifyCode: mockVerifyCode,
    });

    render(<LoginForm />);

    // Simulate the complete login flow
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send Verification Code'));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    // Enter wrong verification code (like "121212" instead of "123456")
    const codeInput = screen.getByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: '121212' } });

    const loginButton = screen.getByRole('button', { name: /log in/i });
    fireEvent.click(loginButton);

    // Verify the loading state appears
    await waitFor(() => {
      expect(screen.getByText('Verifying...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /verifying/i })).toBeDisabled();
    });

    // Verify the error message appears with the specific message
    await waitFor(() => {
      expect(screen.getByText('Error:')).toBeInTheDocument();
      expect(screen.getByText('Invalid or expired verification code')).toBeInTheDocument();
    });

    // Verify the button state is reset properly
    await waitFor(() => {
      const resetButton = screen.getByRole('button', { name: /log in/i });
      expect(resetButton).toBeEnabled();
      expect(resetButton).toHaveTextContent('Log In');
    });

    // Verify the user can retry (button is functional)
    expect(mockVerifyCode).toHaveBeenCalledWith('test@example.com', '121212');
    
    // Simulate another attempt with a different code
    fireEvent.change(codeInput, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    
    // Verify it calls verifyCode again (user can retry)
    await waitFor(() => {
      expect(mockVerifyCode).toHaveBeenCalledWith('test@example.com', '654321');
    });
  });

  it('should handle network errors gracefully', async () => {
    // Test network error scenario
    const mockRequestVerificationCode = vi.fn().mockResolvedValue(true);
    const mockVerifyCode = vi.fn().mockRejectedValue(new Error('Failed to verify code. Please check your network connection.'));
    
    mockUseAuth.mockReturnValue({
      ...defaultAuthContextValue,
      requestVerificationCode: mockRequestVerificationCode,
      verifyCode: mockVerifyCode,
    });

    render(<LoginForm />);

    // Complete the flow with a network error
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send Verification Code'));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    const codeInput = screen.getByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    // Verify network error is displayed
    await waitFor(() => {
      expect(screen.getByText('Failed to verify code. Please check your network connection.')).toBeInTheDocument();
    });

    // Verify button state is reset
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
    });
  });

  it('should handle non-Error exceptions gracefully', async () => {
    // Test when something other than an Error object is thrown
    const mockRequestVerificationCode = vi.fn().mockResolvedValue(true);
    const mockVerifyCode = vi.fn().mockRejectedValue('Some string error');
    
    mockUseAuth.mockReturnValue({
      ...defaultAuthContextValue,
      requestVerificationCode: mockRequestVerificationCode,
      verifyCode: mockVerifyCode,
    });

    render(<LoginForm />);

    // Complete the flow
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send Verification Code'));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    const codeInput = screen.getByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    // Verify fallback error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Verification failed. Please check your code and try again.')).toBeInTheDocument();
    });

    // Verify button state is reset
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
    });
  });

  it('should prevent multiple simultaneous verification attempts', async () => {
    // Test that clicking multiple times doesn't cause issues
    const mockRequestVerificationCode = vi.fn().mockResolvedValue(true);
    const mockVerifyCode = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ userId: '1', email: 'test@example.com' }), 100))
    );
    
    mockUseAuth.mockReturnValue({
      ...defaultAuthContextValue,
      requestVerificationCode: mockRequestVerificationCode,
      verifyCode: mockVerifyCode,
    });

    render(<LoginForm />);

    // Set up the form
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send Verification Code'));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    const codeInput = screen.getByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });

    // Click multiple times rapidly
    const loginButton = screen.getByRole('button', { name: /log in/i });
    fireEvent.click(loginButton);
    fireEvent.click(loginButton);
    fireEvent.click(loginButton);

    // Verify verifyCode is only called once (protection against multiple calls)
    await waitFor(() => {
      expect(mockVerifyCode).toHaveBeenCalledTimes(1);
    });
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

    // The error should be displayed from AuthContext
    await waitFor(() => {
      expect(screen.getByText('Invalid verification code from AuthContext')).toBeInTheDocument();
    });

    // The button should be enabled
    expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
  });
});