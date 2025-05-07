import axios from 'axios';
import cookieService from './cookieService';
import { z } from 'zod';

// Track authentication state to prevent duplicate API calls
let _pendingAuthCheck = false;
let _lastAuthResult = false; 
let _lastAuthCheckTime = 0;

// Extend AxiosRequestConfig to include the _retry property
declare module 'axios' {
  export interface AxiosRequestConfig {
    _retry?: boolean;
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// API client instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: this ensures cookies are sent with requests
});

// Log API configuration for debugging
console.log(`API client configured with baseURL: ${API_URL}`);

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * API Interceptors
 * 
 * With HTTP-only cookies, we don't need to manually attach tokens to requests
 * The browser will automatically send cookies with the request
 * 
 * We still have interceptors for:
 * 1. Response error handling for 401 Unauthorized (token expired)
 * 2. Automatic token refresh when needed
 */
let isRefreshing = false;
let failedQueue: { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }[] = [];

// Function to set the JWT token in the Authorization header
export const setJwtToken = (token: string) => {
  // Add token to default headers for all future requests
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  console.log('JWT token set in Authorization header');
};

// Function to clear the JWT token from the Authorization header
export const clearJwtToken = () => {
  delete api.defaults.headers.common['Authorization'];
  console.log('JWT token cleared from Authorization header');
};

// Process failed requests queue after token refresh
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Response interceptor for handling 401 errors and token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // If error response is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If we're already refreshing, add this request to the queue
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token
        const refreshed = await auth.refreshToken();
        
        if (refreshed) {
          // If refresh successful, process the queue and retry the original request
          processQueue(null);
          return api(originalRequest);
        } else {
          // If refresh failed, reject all queued requests
          processQueue(new Error('Refresh token failed'));
          
          // Redirect to login page
          window.location.href = '/login';
          return Promise.reject(error);
        }
      } catch (refreshError) {
        // Handle refresh error
        processQueue(refreshError instanceof Error ? refreshError : new Error('Unknown refresh error'));
        
        // Redirect to login page
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

// Response schemas
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  playaName: z.string().nullable().optional(),
  profilePicture: z.string().nullable().optional(),
  role: z.enum(['ADMIN', 'STAFF', 'PARTICIPANT']),
  isEmailVerified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Include additional fields that may be needed for profile validation
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  stateProvince: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
});

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  userId: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
});

export const CoreConfigSchema = z.object({
  id: z.string(),
  campName: z.string(),
  campDescription: z.string().nullable().optional(),
  homePageBlurb: z.string().nullable().optional(),
  campBannerUrl: z.string().nullable().optional(),
  campBannerAltText: z.string().nullable().optional(),
  campIconUrl: z.string().nullable().optional(),
  campIconAltText: z.string().nullable().optional(),
  registrationYear: z.number(),
  earlyRegistrationOpen: z.boolean(),
  registrationOpen: z.boolean(),
  // Fix for "Expected string, received null" error
  registrationTerms: z.string().nullable().optional(),
  allowDeferredDuesPayment: z.boolean(),
  stripeEnabled: z.boolean(),
  // Fix for "Expected string, received null" error
  stripePublicKey: z.string().nullable().optional(),
  paypalEnabled: z.boolean(),
  // Fix for "Expected string, received null" error
  paypalClientId: z.string().nullable().optional(),
  paypalMode: z.enum(['sandbox', 'live']),
  timeZone: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// API Types
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type CoreConfig = z.infer<typeof CoreConfigSchema>;

// API Functions
export const auth = {
  /**
   * Request an email verification code to be sent for login/registration
   * @param email The email address to send the verification code to
   * @returns A promise that resolves to true if the code was successfully sent
   */
  requestVerificationCode: async (email: string): Promise<boolean> => {
    try {
      // Use a more explicit API call with debugging
      console.log(`API: Requesting verification code for ${email}`);
      const response = await api.post('/auth/request-login-code', { email }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });
      
      // Log response for debugging
      console.log('API response:', response.status, response.statusText);
      
      // Check for a success response
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      // Properly type the error for safer access
      const axiosError = error as {
        message?: string;
        response?: { status?: number; statusText?: string };
      };
      console.error(
        'Error requesting verification code:',
        axiosError.message, 
        axiosError.response?.status,
        axiosError.response?.statusText
      );
      return false;
    }
  },
  
  /**
   * Verify email code and login or register the user
   */
  verifyCode: async (email: string, code: string) => {
    try {
      console.log(`API: Verifying code for ${email}`);
      const response = await api.post<AuthResponse>('/auth/login-with-code', { email, code });
      
      // Log response for debugging
      console.log('API response:', response.status, response.statusText);
      
      // Parse and validate the response using Zod schema
      const parsedResponse = AuthResponseSchema.parse(response.data);
      
      // Store the JWT token and add it to future request headers
      if (parsedResponse.accessToken) {
        setJwtToken(parsedResponse.accessToken);
      }
      
      return parsedResponse;
    } catch (error) {
      // Properly type the error for safer access
      const axiosError = error as {
        message?: string;
        response?: { 
          status?: number; 
          statusText?: string; 
          data?: { message?: string; error?: string; statusCode?: number };
        };
      };
      
      console.error(
        'Error verifying code:',
        axiosError.message,
        axiosError.response?.status,
        axiosError.response?.statusText,
        axiosError.response?.data
      );
      
      // Important: Rethrow the error so it's properly caught by the AuthContext
      throw new Error(axiosError.response?.data?.message || 'Failed to verify code. Please check your network connection.');
    }
  },
  
  /**
   * Complete registration with additional user details
   * Only required for new users after verifying email
   * 
   * Note: This endpoint is not yet implemented in the backend.
   * For now, we'll use the regular register endpoint as a fallback.
   */
  completeRegistration: async (data: {
    firstName: string;
    lastName: string;
    playaName?: string;
  }) => {
    // Since the complete-registration endpoint doesn't exist yet,
    // we'll use the register endpoint as a fallback
    // This will need to be updated once the backend implements the endpoint
    const response = await api.post<AuthResponse>('/auth/register', {
      ...data,
      email: localStorage.getItem('pendingLoginEmail') || '',
      password: 'temporary-password', // This will be replaced with a proper flow later
    });
    return AuthResponseSchema.parse(response.data);
  },
  
  /**
   * Get the current user profile
   */
  getProfile: async () => {
    const response = await api.get<User>('/auth/profile');
    return UserSchema.parse(response.data);
  },
  
  /**
   * Refresh the authentication token
   * 
   * Note: This endpoint is not yet implemented in the backend.
   * For now, we'll use a mock implementation that always returns true.
   */
  refreshToken: async () => {
    // Since the refresh endpoint doesn't exist yet, we'll mock it
    // This will need to be updated once the backend implements the endpoint
    try {
      // Try to access a protected endpoint to see if our token is still valid
      await api.get('/auth/profile');
      return true;
    } catch {
      // If we get any error, our token is likely invalid
      return false;
    }
  },
  
  /**
   * Logout the user and clear cookies
   * 
   * Note: This endpoint is not yet implemented in the backend.
   * For now, we'll just clear local state and cookies on the client side.
   */
  logout: async () => {
    // Since the logout endpoint doesn't exist yet, we'll just clear local state
    // This will need to be updated once the backend implements the endpoint
    localStorage.clear();
    // Clear JWT token from memory and request headers
    clearJwtToken();
    // Clear all cookies by setting them to expire in the past
    document.cookie.split(';').forEach(cookie => {
      document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
    });
    
    // Update cached auth state after logout
    _lastAuthResult = false;
    _lastAuthCheckTime = Date.now();
    
    return { data: { success: true } };
  },
  
  /**
   * Check if the user is currently authenticated
   * First checks for the authenticated state before making an API call
   */
  checkAuth: async () => {
    // First check if user is authenticated according to client-side state
    if (!cookieService.isAuthenticated()) {
      console.log('Skip auth check - no auth cookie');
      _lastAuthResult = false;
      _lastAuthCheckTime = Date.now();
      return false;
    }
    
    // Check if we have a recent auth result to use instead of making another API call
    // Only use cached result if it's less than 5 seconds old
    if (Date.now() - _lastAuthCheckTime < 5000) {
      console.log('Using cached auth result:', _lastAuthResult);
      return _lastAuthResult;
    }
    
    // Prevent multiple simultaneous auth checks
    if (_pendingAuthCheck) {
      console.log('Auth check already in progress, waiting...');
      // Wait for the pending check to complete (simple debouncing)
      await new Promise(resolve => setTimeout(resolve, 100));
      return _lastAuthResult;
    }
    
    try {
      _pendingAuthCheck = true;
      console.log('Making auth test API call');
      const response = await api.get<{ message: string }>('/auth/test');
      _lastAuthResult = response.data.message === 'Authentication is working';
      _lastAuthCheckTime = Date.now();
      return _lastAuthResult;
    } catch (e) {
      // Log error details for debugging
      console.log('Auth check failed:', e instanceof Error ? e.message : 'Unknown error');
      _lastAuthResult = false;
      _lastAuthCheckTime = Date.now();
      return false;
    } finally {
      _pendingAuthCheck = false;
    }
  }
};

export const config = {
  getCurrent: async () => {
    try {
      console.log('API: Fetching public configuration');
      // Use the dedicated public endpoint that doesn't require authentication
      const response = await api.get<CoreConfig>('/public/config');
      console.log('API response:', response.status, response.statusText);
      return CoreConfigSchema.parse(response.data);
    } catch (error) {
      // Properly type the error for safer access
      const axiosError = error as {
        message?: string;
        code?: string;
        response?: { 
          status?: number; 
          statusText?: string;
          data?: { message?: string; error?: string };
        };
      };
      
      // Different error message based on error type (network vs API error)
      let errorMessage = 'Failed to fetch configuration';
      
      // Network connectivity errors
      if (axiosError.code === 'ERR_NETWORK' || 
          axiosError.message?.includes('Network Error') ||
          axiosError.message?.includes('Connection refused')) {
        errorMessage = 'Cannot connect to API server - please check network connection or server status';
      } 
      // API errors
      else if (axiosError.response) {
        errorMessage = axiosError.response.data?.message || 
                       `API Error (${axiosError.response.status}): ${axiosError.response.statusText}`;
      }
      
      console.error('Error fetching configuration:', errorMessage, axiosError);
      throw new Error(errorMessage);
    }
  },
};