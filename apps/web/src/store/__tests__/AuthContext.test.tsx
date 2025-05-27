// React is needed for JSX even if not directly referenced
// @ts-expect-error - React is used in JSX transformations
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider } from '../AuthContext';
import { useAuth } from '../authUtils';
import { auth as authApi } from '../../lib/api';
import type { Mock } from 'vitest';

// Mock cookieService
vi.mock('../../lib/cookieService', () => ({
  default: {
    setAuthenticatedState: vi.fn().mockResolvedValue(undefined),
    clearAuthTokens: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockReturnValue(false),
  },
}));

// Create mocks without referencing variables that need to be hoisted
vi.mock('../../lib/api', () => ({
  auth: {
    requestVerificationCode: vi.fn(),
    verifyCode: vi.fn().mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.playaplan.app',
      firstName: 'Test',
      lastName: 'User',
      role: 'PARTICIPANT',
      accessToken: 'mock-token'
    }),
    getProfile: vi.fn().mockResolvedValue({
      id: 'user-123',
      email: 'test@example.playaplan.app',
      firstName: 'Test',
      lastName: 'User',
      role: 'PARTICIPANT',
      allowEarlyRegistration: false,
    }),
    logout: vi.fn(),
    checkAuth: vi.fn(),
    refreshToken: vi.fn(),
  },
  clearJwtToken: vi.fn(),
  setJwtToken: vi.fn(),
  initializeAuthFromStorage: vi.fn().mockReturnValue(false),
  JWT_TOKEN_STORAGE_KEY: 'playaplan_jwt_token',
}));

// Create a test component to access the auth context
const TestComponent = () => {
  const { 
    user, 
    isLoading, 
    error, 
    isAuthenticated, 
    requestVerificationCode, 
    verifyCode, 
    logout 
  } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="error">{error || 'no error'}</div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'no user'}</div>
      <button 
        data-testid="request-code-btn" 
        onClick={() => requestVerificationCode('test@example.playaplan.app')}
      >
        Request Code
      </button>
      <button 
        data-testid="verify-code-btn" 
        onClick={() => verifyCode('test@example.playaplan.app', '123456')}
      >
        Verify Code
      </button>
      <button 
        data-testid="logout-btn" 
        onClick={() => logout()}
      >
        Logout
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (localStorage.getItem as Mock).mockReturnValue(null);
    (localStorage.setItem as Mock).mockImplementation(() => {});
    (localStorage.removeItem as Mock).mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should initialize with default values', async () => {
    // Mock API responses for initialization
    (authApi.checkAuth as Mock).mockResolvedValue(false);

    // Render the component within act to handle state updates
    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });
    
    // Wait for all state updates to complete
    // The AuthProvider initializes async, so we need to wait for the loading state
    await waitFor(() => {
      // First make sure the element exists
      const loadingElement = screen.getByTestId('loading');
      // Then check its content is 'false'
      return loadingElement.textContent === 'false';
    }, { timeout: 1000 });
    
    // Now check the other initialization values
    expect(screen.getByTestId('error').textContent).toBe('no error');
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('no user');
  });
  
  describe('requestVerificationCode', () => {
    it('should set loading state during API call', async () => {
      // Mock the API to delay its response
      (authApi.requestVerificationCode as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({}), 100))
      );
      
      // Render component with act to handle state updates
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      // Wait for initial state to settle
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      
      // Click the button to request code
      await act(async () => {
        screen.getByTestId('request-code-btn').click();
      });
      
      // Check loading state is true during API call
      expect(screen.getByTestId('loading').textContent).toBe('true');
      
      // Wait for API call to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
    });
    
    it('should store email in localStorage on success', async () => {
      (authApi.requestVerificationCode as Mock).mockResolvedValue({});
      
      // Render with act
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      // Wait for initial render to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      
      // Click the button to request code
      await act(async () => {
        screen.getByTestId('request-code-btn').click();
      });
      
      // Check localStorage was updated
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'pendingLoginEmail',
        'test@example.playaplan.app'
      );
    });
    
    it('should set error state on API failure', async () => {
      (authApi.requestVerificationCode as Mock).mockRejectedValue(
        new Error('Failed to send code')
      );
      
      // Render with act
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      
      // Click the button to request code
      await act(async () => {
        screen.getByTestId('request-code-btn').click();
      });
      
      // Check error state
      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toContain('Failed to send verification code');
      });
      
      // Check loading state is reset
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });
  
  describe('verifyCode', () => {
    const mockAuthResponse = {
      userId: 'user-123',
      email: 'test@example.playaplan.app',
      firstName: 'Test',
      lastName: 'User',
      role: 'PARTICIPANT',
      accessToken: 'mock-token'
    };
    
    it('should set loading state during API call', async () => {
      // Mock the API to delay its response
      (authApi.verifyCode as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockAuthResponse), 100))
      );
      (authApi.getProfile as Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.playaplan.app',
        firstName: 'Test',
        lastName: 'User',
        role: 'PARTICIPANT',
        allowEarlyRegistration: false,
      });
      
      // Render with act
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      
      // Click the button to verify code
      await act(async () => {
        screen.getByTestId('verify-code-btn').click();
      });
      
      // Check loading state is true during API call
      expect(screen.getByTestId('loading').textContent).toBe('true');
      
      // Wait for API call to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
    });
    
    it('should update user state and authentication on success', async () => {
      (authApi.verifyCode as Mock).mockResolvedValue(mockAuthResponse);
      (authApi.getProfile as Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.playaplan.app',
        firstName: 'Test',
        lastName: 'User',
        role: 'PARTICIPANT',
        allowEarlyRegistration: false,
      });
      
      // Render with act
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      
      // Click the button to verify code
      await act(async () => {
        screen.getByTestId('verify-code-btn').click();
      });
      
      // Check authentication state
      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('true');
      });
      
      // Check user state is updated
      expect(screen.getByTestId('user').textContent).toContain('Test');
      expect(screen.getByTestId('user').textContent).toContain('test@example.playaplan.app');
      
      // Check localStorage was cleared
      expect(localStorage.removeItem).toHaveBeenCalledWith('pendingLoginEmail');
    });

    it('should successfully login with verification code', async () => {
      // Get reference to mocked functions
      const { auth } = await import('../../lib/api');
      
      // Define the mock response explicitly
      (auth.verifyCode as Mock).mockResolvedValueOnce({
        userId: 'user-123',
        email: 'test@example.playaplan.app',
        firstName: 'Test',
        lastName: 'User',
        role: 'PARTICIPANT',
        accessToken: 'mock-token'
      });
      (auth.getProfile as Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.playaplan.app',
        firstName: 'Test',
        lastName: 'User',
        role: 'PARTICIPANT',
        allowEarlyRegistration: false,
      });
      
      // Render with act
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      
      // Reset mock count
      vi.clearAllMocks();
      
      // Click the button to verify code
      await act(async () => {
        screen.getByTestId('verify-code-btn').click();
      });
      
      // Wait for authentication to complete
      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('true');
      });
      
      // Verify verifyCode was called
      expect(auth.verifyCode).toHaveBeenCalledWith('test@example.playaplan.app', '123456');
    });
  });
});
