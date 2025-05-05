import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// We need to mock axios before importing our code under test
vi.mock('axios', () => {
  return {
    default: {
      create: () => ({
        post: vi.fn(),
        get: vi.fn(),
        put: vi.fn(), // Add PUT method for profile updates
        patch: vi.fn(),
        defaults: { headers: { common: {} } },
        interceptors: {
          response: {
            use: vi.fn()
          },
          request: {
            use: vi.fn() // Add request interceptor mock
          }
        }
      })
    }
  };
});

// Now we can import our module under test
import { auth, AuthResponseSchema, api } from '../api';



describe('API module', () => {
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Setup localStorage mock for the email
    (localStorage.getItem as Mock).mockReturnValue('test@example.com');
    
    // Mock the parse method of AuthResponseSchema to return the correct type
    vi.spyOn(AuthResponseSchema, 'parse').mockImplementation((data) => {
      return data as ReturnType<typeof AuthResponseSchema.parse>;
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('auth.completeRegistration', () => {
    const mockUserData = {
      firstName: 'John',
      lastName: 'Doe',
      playaName: 'Dust Rider',
    };
    
    const mockAuthResponse = {
      accessToken: 'mock-token-12345',
      userId: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'PARTICIPANT',
    };
    
    it('should call the register endpoint as fallback with correct parameters', async () => {
      // Arrange
      // Setup successful response for the API call
      (api.post as Mock).mockResolvedValueOnce({
        data: mockAuthResponse,
      });
      
      // Act
      await auth.completeRegistration(mockUserData);
      
      // Assert
      // Check that the correct fallback endpoint was called
      expect(api.post).toHaveBeenCalledWith('/auth/register', {
        ...mockUserData,
        email: 'test@example.com',
        password: expect.any(String), // We expect some kind of password is included
      });
    });
    
    it('should retrieve the email from localStorage', async () => {
      // Arrange
      (api.post as Mock).mockResolvedValueOnce({
        data: mockAuthResponse,
      });
      
      // Act
      await auth.completeRegistration(mockUserData);
      
      // Assert
      expect(localStorage.getItem).toHaveBeenCalledWith('pendingLoginEmail');
    });
    
    it('should handle empty email in localStorage gracefully', async () => {
      // Arrange
      (localStorage.getItem as Mock).mockReturnValueOnce(null);
      (api.post as Mock).mockResolvedValueOnce({
        data: mockAuthResponse,
      });
      
      // Act
      try {
        await auth.completeRegistration(mockUserData);
      } catch {
        // Expected to fail in test
      }
      
      // Assert
      expect(api.post).toHaveBeenCalledWith('/auth/register', {
        ...mockUserData,
        email: '', // Should use empty string as fallback
        password: expect.any(String),
      });
    });
    
    it('should parse and validate the response using zod schema', async () => {
      // Arrange
      // Spy on the parse method of AuthResponseSchema
      const parseSpy = vi.spyOn(AuthResponseSchema, 'parse');
      (api.post as Mock).mockResolvedValueOnce({
        data: mockAuthResponse,
      });
      
      // Act
      try {
        await auth.completeRegistration(mockUserData);
      } catch {
        // Expected to fail in test
      }
      
      // Assert
      expect(parseSpy).toHaveBeenCalledWith(mockAuthResponse);
    });
    
    it('should throw error if API request fails', async () => {
      // Arrange
      const apiError = new Error('API Error');
      (api.post as Mock).mockRejectedValueOnce(apiError);
      
      // Act & Assert
      await expect(auth.completeRegistration(mockUserData)).rejects.toThrow('API Error');
    });
  });
});
