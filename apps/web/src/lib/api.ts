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
  campId: z.string(),
  jobCategoryIds: z.array(z.string()),
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

// Camping options API functions
export const campingOptions = {
  /**
   * Get all camping options
   * @param includeDisabled Whether to include disabled options (default: false)
   * @param campId Optional camp ID to filter by
   * @returns A promise that resolves to an array of camping options
   */
  getAll: async (includeDisabled = false, campId?: string): Promise<CampingOption[]> => {
    try {
      let url = '/camping-options';
      const params = new URLSearchParams();
      
      if (includeDisabled) {
        params.append('includeDisabled', 'true');
      }
      
      if (campId) {
        params.append('campId', campId);
      }
      
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
};

// Job Category Schema
export const JobCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  staffOnly: z.boolean().default(false),
});

export type JobCategory = z.infer<typeof JobCategorySchema>;

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
    const response = await api.post<JobCategory>("/job-categories", data);
    return JobCategorySchema.parse(response.data);
  },
  update: async (id: string, data: Partial<Omit<JobCategory, 'id'>>): Promise<JobCategory> => {
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