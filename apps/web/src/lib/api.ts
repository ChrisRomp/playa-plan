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

// Prioritize runtime config over build-time env vars, but skip unprocessed templates
const runtimeApiUrl = window.RUNTIME_CONFIG?.API_URL;
const isTemplate = runtimeApiUrl?.includes('${');
const API_URL = (!isTemplate && runtimeApiUrl) || import.meta.env.VITE_API_URL || 'http://localhost:3000';

// API client instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: this ensures cookies are sent with requests
  timeout: 10000, // 10 second timeout
});

// Log API configuration for debugging
console.log(`API client configured with baseURL: ${API_URL}`);

// Storage key for JWT token
export const JWT_TOKEN_STORAGE_KEY = 'playaplan_jwt_token';

// Promise that resolves when auth initialization is complete
export let authInitialized = Promise.resolve(false);

// Function to initialize JWT token from localStorage on application startup
export const initializeAuthFromStorage = (): Promise<boolean> => {
  const initPromise = new Promise<boolean>((resolve) => {
    try {
      // Only try to use localStorage in browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedToken = localStorage.getItem(JWT_TOKEN_STORAGE_KEY);
        if (storedToken) {
          // Set the token in the Authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          console.log('JWT token loaded from localStorage and set in Authorization header');
          
          // Also ensure the auth cookie is set if we have a token
          if (!cookieService.isAuthenticated()) {
            // Handle the async operation with .then() instead of await
            cookieService.setAuthenticatedState()
              .then(() => {
                console.log('Auth cookie set based on JWT token presence');
                resolve(true);
              })
              .catch((e) => {
                console.error('Error setting auth cookie', e);
                resolve(true); // Still resolve as true since token is valid
              });
            return; // Return early as resolve will be called in the promise chain
          }
          
          resolve(true);
          return;
        }
      }
    } catch (e) {
      console.error('Error initializing auth from storage', e);
    }
    resolve(false);
  });
  
  // Update the exported promise
  authInitialized = initPromise;
  return initPromise;
};

// Safely initialize auth from storage to prevent test issues
// We use a try-catch and feature detection to avoid issues in test environments
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    // Initialize auth synchronously on module load
    initializeAuthFromStorage();
  }
} catch {
  console.log('Unable to initialize auth from storage (likely in test environment)');
}

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

// Function to set the JWT token in the Authorization header and localStorage
export const setJwtToken = (token: string) => {
  // Add token to default headers for all future requests
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  
  try {
    // Only try to use localStorage in browser environment
    if (typeof window !== 'undefined' && window.localStorage) {
      // Store token in localStorage for persistence across page refreshes
      localStorage.setItem(JWT_TOKEN_STORAGE_KEY, token);
    }
  } catch (e) {
    console.error('Error storing JWT token in localStorage', e);
  }
  
  console.log('JWT token set in Authorization header and localStorage');
};

// Function to clear the JWT token from the Authorization header and localStorage
export const clearJwtToken = () => {
  delete api.defaults.headers.common['Authorization'];
  
  try {
    // Only try to use localStorage in browser environment
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(JWT_TOKEN_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error removing JWT token from localStorage', e);
  }
  
  console.log('JWT token cleared from Authorization header and localStorage');
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
    
    // Skip token refresh for login-related endpoints where 401 is expected
    const isLoginEndpoint = originalRequest.url?.includes('/auth/login-with-code') || 
                           originalRequest.url?.includes('/auth/request-login-code') ||
                           originalRequest.url?.includes('/auth/register');
    
    // If error response is 401 and we haven't already tried to refresh
    // and this is not a login endpoint
    if (error.response?.status === 401 && !originalRequest._retry && !isLoginEndpoint) {
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
  firstName: z.string().max(50),
  lastName: z.string().max(50),
  playaName: z.string().max(50).nullable().optional(),
  profilePicture: z.string().nullable().optional(),
  role: z.enum(['ADMIN', 'STAFF', 'PARTICIPANT']),
  isEmailVerified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Include additional fields that may be needed for profile validation
  phone: z.string().max(50).nullable().optional(),
  city: z.string().max(50).nullable().optional(),
  stateProvince: z.string().max(50).nullable().optional(),
  country: z.string().max(50).nullable().optional(),
  emergencyContact: z.string().max(1024).nullable().optional(),
  // User permission fields
  allowRegistration: z.boolean().optional(),
  allowEarlyRegistration: z.boolean().optional(),
  allowDeferredDuesPayment: z.boolean().optional(),
  allowNoJob: z.boolean().optional(),
  internalNotes: z.string().nullable().optional(),
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

export const CampingOptionFieldSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string().nullable().optional(),
  dataType: z.enum(['STRING', 'MULTILINE_STRING', 'INTEGER', 'NUMBER', 'BOOLEAN', 'DATE']),
  required: z.boolean(),
  maxLength: z.number().nullable().optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  order: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  campingOptionId: z.string(),
});

export const CampingOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  enabled: z.boolean(),
  workShiftsRequired: z.number(),
  participantDues: z.number(),
  staffDues: z.number(),
  maxSignups: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // campId field has been removed
  jobCategoryIds: z.array(z.string()).default([]),
  currentRegistrations: z.number().optional(),
  availabilityStatus: z.boolean().optional(),
  fields: z.array(CampingOptionFieldSchema).optional(),
});

// API Types
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type CoreConfig = z.infer<typeof CoreConfigSchema>;
export type CampingOption = z.infer<typeof CampingOptionSchema>;
export type CampingOptionField = z.infer<typeof CampingOptionFieldSchema>;

// Forward declarations to break circular dependencies
export interface IJobCategory {
  id: string;
  name: string;
  description: string;
  staffOnly?: boolean;
  alwaysRequired?: boolean;
}

export interface IShift {
  id: string;
  name: string;
  description: string;
  /** 
   * ISO string with a placeholder date (e.g., 2025-01-01) and the time
   * The date portion is just a placeholder - only the time is relevant
   */
  startTime: string;
  /** 
   * ISO string with a placeholder date (e.g., 2025-01-01) and the time
   * The date portion is just a placeholder - only the time is relevant
   */
  endTime: string;
  dayOfWeek: string;
  // campId field has been removed
  jobs?: IJob[];
}

export interface IJob {
  id: string;
  name: string;
  location: string;
  categoryId: string;
  category?: IJobCategory;
  shiftId: string;
  shift?: IShift;
  maxRegistrations: number;
  currentRegistrations?: number;
  staffOnly?: boolean;
  alwaysRequired?: boolean;
}

// Job Category Schema
export const JobCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  staffOnly: z.boolean().default(false),
  alwaysRequired: z.boolean().default(false),
});

export type JobCategory = z.infer<typeof JobCategorySchema>;

// Break circular references with explicit typing
export const ShiftSchema: z.ZodType<IShift> = z.lazy(() => 
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    dayOfWeek: z.string(),
    // campId field has been removed
    jobs: z.array(JobSchema).optional(),
  })
);

export type Shift = z.infer<typeof ShiftSchema>;

// Job Schema with lazy evaluation
export const JobSchema: z.ZodType<IJob> = z.lazy(() => 
  z.object({
    id: z.string(),
    name: z.string(),
    location: z.string(),
    categoryId: z.string(),
    category: JobCategorySchema.optional(),
    shiftId: z.string(),
    shift: ShiftSchema.optional(),
    maxRegistrations: z.number(),
    currentRegistrations: z.number().optional(),
    staffOnly: z.boolean().optional(),
    alwaysRequired: z.boolean().optional(),
  })
);

export type Job = z.infer<typeof JobSchema>;

// Payment interface
export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  provider: 'STRIPE' | 'PAYPAL';
  providerRefId?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  registrationId?: string;
}

// Registration interface
export interface Registration {
  id: string;
  userId: string;
  year: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
  createdAt: string;
  updatedAt: string;
  user?: User;
  jobs: Array<{
    id: string;
    registrationId: string;
    jobId: string;
    createdAt: string;
    job: Job;
  }>;
  payments: Payment[];
}

// Camping Option Registration interface
export interface CampingOptionRegistration {
  id: string;
  userId: string;
  campingOptionId: string;
  createdAt: string;
  updatedAt: string;
  campingOption?: CampingOption;
}

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
   * This uses the /auth/refresh endpoint to get a new token
   * while using the current token for authentication
   */
  refreshToken: async () => {
    try {
      // Call the refresh endpoint to get a new token
      const response = await api.post<AuthResponse>('/auth/refresh');
      const parsedResponse = AuthResponseSchema.parse(response.data);
      
      // Store the new token
      if (parsedResponse.accessToken) {
        setJwtToken(parsedResponse.accessToken);
      }
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
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
    // First check if we have a JWT token in localStorage
    const hasToken = localStorage.getItem(JWT_TOKEN_STORAGE_KEY) !== null;
    
    // If no token in localStorage, not authenticated
    if (!hasToken) {
      console.log('Skip auth check - no JWT token in localStorage');
      _lastAuthResult = false;
      _lastAuthCheckTime = Date.now();
      return false;
    }
    
    // Check if user is authenticated according to client-side state
    if (!cookieService.isAuthenticated()) {
      console.log('Auth cookie missing but JWT token exists - will verify with server');
      // Continue to API check below instead of returning false
      // We'll set the cookie if the API check succeeds
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
      
      // If the API check succeeded but the cookie is missing, set it now
      if (_lastAuthResult && !cookieService.isAuthenticated()) {
        console.log('API check succeeded but cookie missing - restoring cookie');
        await cookieService.setAuthenticatedState();
      }
      
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

// Camping options API functions
export const campingOptions = {
  /**
   * Get all camping options
   * @param includeDisabled Whether to include disabled options (default: false)
   * @returns A promise that resolves to an array of camping options
   */
  getAll: async (includeDisabled = false): Promise<CampingOption[]> => {
    try {
      let url = '/camping-options';
      const params = new URLSearchParams();
      
      if (includeDisabled) {
        params.append('includeDisabled', 'true');
      }
      
      // campId check removed
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await api.get<CampingOption[]>(url);
      return response.data.map(option => CampingOptionSchema.parse(option));
    } catch (error) {
      console.error('Error fetching camping options:', error);
      throw error;
    }
  },
  
  /**
   * Get a camping option by ID
   * @param id The ID of the camping option
   * @returns A promise that resolves to the camping option
   */
  getById: async (id: string): Promise<CampingOption> => {
    try {
      const response = await api.get<CampingOption>(`/camping-options/${id}`);
      return CampingOptionSchema.parse(response.data);
    } catch (error) {
      console.error(`Error fetching camping option with ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Create a new camping option
   * @param data The camping option data
   * @returns A promise that resolves to the created camping option
   */
  create: async (data: Omit<CampingOption, 'id' | 'createdAt' | 'updatedAt' | 'currentRegistrations' | 'availabilityStatus' | 'fields' | 'campId'> & { campId?: string }): Promise<CampingOption> => {
    try {
      const response = await api.post<CampingOption>('/camping-options', data);
      return CampingOptionSchema.parse(response.data);
    } catch (error) {
      console.error('Error creating camping option:', error);
      throw error;
    }
  },
  
  /**
   * Update a camping option
   * @param id The ID of the camping option to update
   * @param data The data to update
   * @returns A promise that resolves to the updated camping option
   */
  update: async (id: string, data: Partial<Omit<CampingOption, 'id' | 'createdAt' | 'updatedAt' | 'currentRegistrations' | 'availabilityStatus' | 'fields'>>): Promise<CampingOption> => {
    try {
      const response = await api.patch<CampingOption>(`/camping-options/${id}`, data);
      return CampingOptionSchema.parse(response.data);
    } catch (error) {
      console.error(`Error updating camping option with ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Delete a camping option
   * @param id The ID of the camping option to delete
   * @returns A promise that resolves to the deleted camping option
   */
  delete: async (id: string): Promise<CampingOption> => {
    try {
      const response = await api.delete<CampingOption>(`/camping-options/${id}`);
      return CampingOptionSchema.parse(response.data);
    } catch (error) {
      console.error(`Error deleting camping option with ID ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Get all fields for a camping option
   * @param campingOptionId The ID of the camping option
   * @returns A promise that resolves to an array of camping option fields
   */
  getFields: async (campingOptionId: string): Promise<CampingOptionField[]> => {
    try {
      const response = await api.get<CampingOptionField[]>(`/camping-options/${campingOptionId}/fields`);
      return response.data.map(field => CampingOptionFieldSchema.parse(field));
    } catch (error) {
      console.error(`Error fetching fields for camping option with ID ${campingOptionId}:`, error);
      throw error;
    }
  },
  
  /**
   * Create a new field for a camping option
   * @param campingOptionId The ID of the camping option
   * @param data The field data
   * @returns A promise that resolves to the created field
   */
  createField: async (campingOptionId: string, data: Omit<CampingOptionField, 'id' | 'createdAt' | 'updatedAt' | 'campingOptionId'>): Promise<CampingOptionField> => {
    try {
      const response = await api.post<CampingOptionField>(`/camping-options/${campingOptionId}/fields`, data);
      return CampingOptionFieldSchema.parse(response.data);
    } catch (error) {
      console.error(`Error creating field for camping option with ID ${campingOptionId}:`, error);
      throw error;
    }
  },
  
  /**
   * Update a field
   * @param campingOptionId The ID of the camping option
   * @param fieldId The ID of the field to update
   * @param data The data to update
   * @returns A promise that resolves to the updated field
   */
  updateField: async (campingOptionId: string, fieldId: string, data: Partial<Omit<CampingOptionField, 'id' | 'createdAt' | 'updatedAt' | 'campingOptionId'>>): Promise<CampingOptionField> => {
    try {
      const response = await api.patch<CampingOptionField>(`/camping-options/${campingOptionId}/fields/${fieldId}`, data);
      return CampingOptionFieldSchema.parse(response.data);
    } catch (error) {
      console.error(`Error updating field with ID ${fieldId}:`, error);
      throw error;
    }
  },
  
  /**
   * Delete a field
   * @param campingOptionId The ID of the camping option
   * @param fieldId The ID of the field to delete
   * @returns A promise that resolves to the deleted field
   */
  deleteField: async (campingOptionId: string, fieldId: string): Promise<CampingOptionField> => {
    try {
      const response = await api.delete<CampingOptionField>(`/camping-options/${campingOptionId}/fields/${fieldId}`);
      return CampingOptionFieldSchema.parse(response.data);
    } catch (error) {
      console.error(`Error deleting field with ID ${fieldId}:`, error);
      throw error;
    }
  },

  /**
   * Reorder fields for a camping option
   * @param campingOptionId The ID of the camping option
   * @param fieldOrders Array of field IDs with their new order values
   * @returns A promise that resolves to the reordered fields
   */
  reorderFields: async (campingOptionId: string, fieldOrders: Array<{ id: string; order: number }>): Promise<CampingOptionField[]> => {
    try {
      const response = await api.patch<CampingOptionField[]>(`/camping-option-fields/reorder/${campingOptionId}`, {
        fieldOrders
      });
      return response.data.map(field => CampingOptionFieldSchema.parse(field));
    } catch (error) {
      console.error('Error reordering fields for camping option with ID:', campingOptionId, error);
      throw error;
    }
  }
};

export const jobCategories = {
  getAll: async (): Promise<JobCategory[]> => {
    const response = await api.get<JobCategory[]>("/job-categories");
    return response.data.map((item: unknown) => JobCategorySchema.parse(item));
  },
  getById: async (id: string): Promise<JobCategory> => {
    const response = await api.get<JobCategory>(`/job-categories/${id}`);
    return JobCategorySchema.parse(response.data);
  },
  create: async (data: Omit<JobCategory, 'id'>): Promise<JobCategory> => {
    // Send all fields including alwaysRequired to the API
    const response = await api.post<JobCategory>("/job-categories", data);
    return JobCategorySchema.parse(response.data);
  },
  update: async (id: string, data: Partial<Omit<JobCategory, 'id'>>): Promise<JobCategory> => {
    // Send all fields including alwaysRequired to the API
    const response = await api.patch<JobCategory>(`/job-categories/${id}`, data);
    return JobCategorySchema.parse(response.data);
  },
  delete: async (id: string): Promise<JobCategory> => {
    try {
      const response = await api.delete<JobCategory>(`/job-categories/${id}`);
      return JobCategorySchema.parse(response.data);
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        throw error;
      }
      throw new Error('Failed to delete job category.');
    }
  },
};

export const jobs = {
  getAll: async (): Promise<Job[]> => {
    const response = await api.get<Job[]>("/jobs");
    return response.data.map(item => {
      // Derive staffOnly and alwaysRequired from the category
      const jobWithDerivedProps = {
        ...JobSchema.parse(item),
        staffOnly: item.category?.staffOnly || false,
        alwaysRequired: item.category?.alwaysRequired || false
      };
      return jobWithDerivedProps;
    });
  },
  getById: async (id: string): Promise<Job> => {
    const response = await api.get<Job>(`/jobs/${id}`);
    const item = response.data;
    // Derive staffOnly and alwaysRequired from the category
    const jobWithDerivedProps = {
      ...JobSchema.parse(item),
      staffOnly: item.category?.staffOnly || false,
      alwaysRequired: item.category?.alwaysRequired || false
    };
    return jobWithDerivedProps;
  },
  create: async (data: Omit<Job, 'id' | 'category' | 'staffOnly' | 'alwaysRequired'>): Promise<Job> => {
    const response = await api.post<Job>("/jobs", data);
    const item = response.data;
    // Derive staffOnly and alwaysRequired from the category
    const jobWithDerivedProps = {
      ...JobSchema.parse(item),
      staffOnly: item.category?.staffOnly || false,
      alwaysRequired: item.category?.alwaysRequired || false
    };
    return jobWithDerivedProps;
  },
  update: async (id: string, data: Partial<Omit<Job, 'id' | 'category' | 'staffOnly' | 'alwaysRequired'>>): Promise<Job> => {
    const response = await api.patch<Job>(`/jobs/${id}`, data);
    const item = response.data;
    // Derive staffOnly and alwaysRequired from the category
    const jobWithDerivedProps = {
      ...JobSchema.parse(item),
      staffOnly: item.category?.staffOnly || false,
      alwaysRequired: item.category?.alwaysRequired || false
    };
    return jobWithDerivedProps;
  },
  delete: async (id: string): Promise<Job> => {
    try {
      const response = await api.delete<Job>(`/jobs/${id}`);
      const item = response.data;
      // Derive staffOnly and alwaysRequired from the category
      const jobWithDerivedProps = {
        ...JobSchema.parse(item),
        staffOnly: item.category?.staffOnly || false,
        alwaysRequired: item.category?.alwaysRequired || false
      };
      return jobWithDerivedProps;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        throw error;
      }
      throw new Error('Failed to delete job.');
    }
  },
};

export const shifts = {
  getAll: async (filters?: { dayOfWeek?: string }): Promise<Shift[]> => {
    let url = "/shifts";
    if (filters) {
      const params = new URLSearchParams();
      if (filters.dayOfWeek) params.append('dayOfWeek', filters.dayOfWeek);
      if (params.toString()) url += `?${params.toString()}`;
    }
    const response = await api.get<Shift[]>(url);
    return response.data.map(item => ShiftSchema.parse(item));
  },
  getById: async (id: string): Promise<Shift> => {
    const response = await api.get<Shift>(`/shifts/${id}`);
    return ShiftSchema.parse(response.data);
  },
  create: async (data: Omit<Shift, 'id' | 'jobs'>): Promise<Shift> => {
    const response = await api.post<Shift>("/shifts", data);
    return ShiftSchema.parse(response.data);
  },
  update: async (id: string, data: Partial<Omit<Shift, 'id' | 'jobs'>>): Promise<Shift> => {
    const response = await api.patch<Shift>(`/shifts/${id}`, data);
    return ShiftSchema.parse(response.data);
  },
  delete: async (id: string): Promise<Shift> => {
    try {
      const response = await api.delete<Shift>(`/shifts/${id}`);
      return ShiftSchema.parse(response.data);
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        throw error;
      }
      throw new Error('Failed to delete shift.');
    }
  },
  getRegistrations: async (shiftId: string): Promise<unknown[]> => {
    const response = await api.get(`/shifts/${shiftId}/registrations`);
    return response.data;
  },
};

export const registrations = {
  /**
   * Get all registrations for the current user
   * @returns A promise that resolves to an array of user registrations
   */
  getMyRegistrations: async (): Promise<Registration[]> => {
    try {
      const response = await api.get<Registration[]>('/registrations/me');
      return response.data;
    } catch (error) {
      console.error('Error fetching user registrations:', error);
      throw error;
    }
  },

  /**
   * Get the current user's registration for a specific year
   * @param year The year to get registration for
   * @returns A promise that resolves to the user's registration for that year
   */
  getMyRegistrationForYear: async (year: number): Promise<Registration | null> => {
    try {
      const response = await api.get<Registration>(`/registrations/me?year=${year}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user registration for year:', error);
      throw error;
    }
  },

  /**
   * Get the complete camp registration for the current user
   * @returns A promise that resolves to the user's complete camp registration
   */
  getMyCampRegistration: async (): Promise<{
    campingOptions: CampingOptionRegistration[];
    customFieldValues: Array<{
      id: string;
      value: string;
      fieldId: string;
      registrationId: string;
      field: CampingOptionField;
    }>;
    jobRegistrations: Registration[];
    hasRegistration: boolean;
  }> => {
    try {
      const response = await api.get('/registrations/camp/me');
      return response.data;
    } catch (error) {
      console.error('Error fetching camp registration:', error);
      throw error;
    }
  },
};

export const reports = {
  /**
   * Get all registrations for staff/admin reports
   * @param filters Optional filters for the report
   * @returns A promise that resolves to an array of all registrations
   */
  getRegistrations: async (filters?: {
    userId?: string;
    jobId?: string;
    year?: number;
  }): Promise<Registration[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.jobId) params.append('jobId', filters.jobId);
      if (filters?.year) params.append('year', filters.year.toString());
      
      const url = `/registrations${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<Registration[]>(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching registrations report:', error);
      throw error;
    }
  },

  /**
   * Get all users for staff/admin reports
   * @returns A promise that resolves to an array of all users
   */
  getUsers: async (): Promise<User[]> => {
    try {
      const response = await api.get<User[]>('/users');
      return response.data;
    } catch (error) {
      console.error('Error fetching users report:', error);
      throw error;
    }
  },

  /**
   * Get all payments for admin reports
   * @param filters Optional filters for the report
   * @returns A promise that resolves to an array of all payments
   */
  getPayments: async (filters?: {
    userId?: string;
    registrationId?: string;
    status?: string;
    provider?: string;
  }): Promise<Payment[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.registrationId) params.append('registrationId', filters.registrationId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.provider) params.append('provider', filters.provider);
      
      const url = `/payments${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get(url);
      
      // Check if the response has a payments array property (matches backend format)
      if (response.data && response.data.payments && Array.isArray(response.data.payments)) {
        return response.data.payments;
      } 
      
      // Fallback if the data is already an array
      if (Array.isArray(response.data)) {
        return response.data;
      }
      
      // If we can't find a valid array, return an empty one
      console.error('Unexpected response format from payments API:', response.data);
      return [];
    } catch (error) {
      console.error('Error fetching payments report:', error);
      throw error;
    }
  },

  /**
   * Get work schedule data organized by shifts, jobs, and user signups
   * @returns A promise that resolves to work schedule data
   */
  getWorkSchedule: async (): Promise<{
    shifts: Array<{
      id: string;
      name: string;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      jobs: Array<{
        id: string;
        name: string;
        location: string;
        maxRegistrations: number;
        categoryId: string;
        category: { id: string; name: string };
        registrations: Array<{
          id: string;
          user: {
            id: string;
            firstName: string;
            lastName: string;
            playaName: string | null;
          };
        }>;
      }>;
    }>;
  }> => {
    try {
      // Get shifts with their jobs and job registrations
      const response = await api.get('/shifts/with-jobs-and-registrations');
      return response.data;
    } catch (error) {
      console.error('Error fetching work schedule data:', error);
      throw error;
    }
  },
};