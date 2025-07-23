/**
 * Cookie Service - Utility for managing HTTP-only cookies securely
 * 
 * This service provides methods for handling JWT tokens via HTTP-only cookies
 * following security best practices to prevent XSS and CSRF attacks.
 */

// Cookie names
// Using variables for consistent naming across the application
export const AUTH_STATUS_COOKIE = 'auth_state';

// Function to get default cookie options with safe window access
const getDefaultCookieOptions = () => ({
  // Note: httpOnly cannot be set via client-side JavaScript
  // It can only be set by the server in HTTP responses
  // Only sent over HTTPS (except in development)
  secure: process.env.NODE_ENV === 'production',
  // Use lax setting to allow cookies on cross-domain requests
  // This is important when API and frontend are on different domains/ports
  sameSite: 'lax' as const,
  // Domain scoped to application domain
  domain: typeof window !== 'undefined' && window.location 
    ? (window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname)
    : 'localhost',
  // Default path
  path: '/'
});

/**
 * Cookie options interface
 */
export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  domain?: string;
  path?: string;
  maxAge?: number;
  expires?: Date;
}

/**
 * Sets a cookie with the specified name, value, and options
 * Note: This function is only used for client-side cookies
 * 
 * IMPORTANT: The httpOnly flag in options is ignored when set client-side.
 * HttpOnly cookies can ONLY be set by the server in HTTP responses.
 * This attribute is included in the interface for documentation purposes only.
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  const cookieOptions = { ...getDefaultCookieOptions(), ...options };
  
  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  
  // Note: Setting httpOnly via client-side JavaScript has no effect
  // This property is ignored by browsers when set via document.cookie
  // It's included in the options for documentation consistency only
  
  if (cookieOptions.secure) {
    cookieString += '; Secure';
  }
  
  if (cookieOptions.sameSite) {
    cookieString += `; SameSite=${cookieOptions.sameSite}`;
  }
  
  if (cookieOptions.domain) {
    cookieString += `; Domain=${cookieOptions.domain}`;
  }
  
  if (cookieOptions.path) {
    cookieString += `; Path=${cookieOptions.path}`;
  }
  
  if (cookieOptions.maxAge) {
    cookieString += `; Max-Age=${cookieOptions.maxAge}`;
  }
  
  if (cookieOptions.expires) {
    cookieString += `; Expires=${cookieOptions.expires.toUTCString()}`;
  }
  
  if (typeof document !== 'undefined') {
    document.cookie = cookieString;
  }
}

/**
 * Gets a cookie value by name
 * Note: This will only work for non-HTTP-only cookies
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  
  const nameString = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split(';');
  
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.indexOf(nameString) === 0) {
      return decodeURIComponent(cookie.substring(nameString.length, cookie.length));
    }
  }
  
  return null;
}

/**
 * Deletes a cookie by setting its expiration date to the past
 */
export function deleteCookie(name: string, options: CookieOptions = {}): void {
  const cookieOptions = { 
    ...options, 
    expires: new Date(0) // Set to epoch time to delete
  };
  
  setCookie(name, '', cookieOptions);
}

/**
 * Important Note: HTTP-only cookies cannot be directly accessed by JavaScript
 * The following methods are placeholders for working with the API that manages
 * HTTP-only cookies on the server side.
 */

/**
 * Store auth tokens by calling the auth API
 * The API will set HTTP-only cookies in its response
 */
/**
 * Sets the authentication state cookie after successful login
 * The actual tokens are managed by the server via HTTP-only cookies
 */
export const setAuthenticatedState = async (): Promise<void> => {
  // We use a regular cookie to track auth state on the client
  // This is safe because it contains no sensitive information
  // Set it to expire in 30 days (similar to typical JWT expiration)
  const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
  setCookie(AUTH_STATUS_COOKIE, 'authenticated', {
    maxAge: thirtyDaysInSeconds,
    // Make sure it's accessible in the root path
    path: '/',
  });
};

/**
 * Clear auth tokens by calling the API logout endpoint
 * The API will clear HTTP-only cookies in its response
 */
export const clearAuthTokens = async (): Promise<void> => {
  // Call API logout endpoint which will clear the HTTP-only cookies
  // This is just a placeholder - the actual implementation will depend on your API
  
  // Clear any non-HTTP-only auth-related cookies we might have set
  deleteCookie(AUTH_STATUS_COOKIE);
};

/**
 * Check if user is authenticated by the presence of the auth_state cookie
 * This is a client-side indicator only and not a security measure
 */
export const isAuthenticated = (): boolean => {
  return getCookie(AUTH_STATUS_COOKIE) === 'authenticated';
};

export default {
  setCookie,
  getCookie,
  deleteCookie,
  setAuthenticatedState,
  clearAuthTokens,
  isAuthenticated
};
