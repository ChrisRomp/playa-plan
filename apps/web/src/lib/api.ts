import axios from 'axios';
import { z } from 'zod';

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
});

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
  playaName: z.string().optional(),
  profilePicture: z.string().optional(),
  role: z.enum(['ADMIN', 'STAFF', 'PARTICIPANT']),
  isEmailVerified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
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
  campDescription: z.string().optional(),
  homePageBlurb: z.string().optional(),
  campBannerUrl: z.string().optional(),
  campBannerAltText: z.string().optional(),
  campIconUrl: z.string().optional(),
  campIconAltText: z.string().optional(),
  registrationYear: z.number(),
  earlyRegistrationOpen: z.boolean(),
  registrationOpen: z.boolean(),
  registrationTerms: z.string().optional(),
  allowDeferredDuesPayment: z.boolean(),
  stripeEnabled: z.boolean(),
  stripePublicKey: z.string().optional(),
  paypalEnabled: z.boolean(),
  paypalClientId: z.string().optional(),
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
   */
  requestVerificationCode: async (email: string) => {
    return await api.post('/auth/request-login-code', { email });
  },
  
  /**
   * Verify email code and login or register the user
   */
  verifyCode: async (email: string, code: string) => {
    const response = await api.post<AuthResponse>('/auth/login-with-code', { email, code });
    return AuthResponseSchema.parse(response.data);
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
    // Clear all cookies by setting them to expire in the past
    document.cookie.split(';').forEach(cookie => {
      document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
    });
    return { data: { success: true } };
  },
  
  /**
   * Check if the user is currently authenticated
   * This makes a lightweight API call to validate the current session
   */
  checkAuth: async () => {
    try {
      // Use the test auth endpoint to check authentication
      const response = await api.get<{ message: string }>('/auth/test');
      return response.data.message === 'Authentication is working';
    } catch {
      // Intentionally ignoring error and returning false for failed auth check
      return false;
    }
  }
};

export const config = {
  getCurrent: async () => {
    const response = await api.get<CoreConfig>('/core-config/current');
    return CoreConfigSchema.parse(response.data);
  },
};