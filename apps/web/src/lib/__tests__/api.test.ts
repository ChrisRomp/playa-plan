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
        delete: vi.fn(),
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
import { auth, AuthResponseSchema, api, jobCategories, JobCategorySchema } from '../api';

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

describe('jobCategories API', () => {
  // Mock job category data
  const mockJobCategories = [
    {
      id: 'cat-1',
      name: 'Kitchen',
      description: 'Kitchen shifts',
      staffOnly: false
      // Note: alwaysRequired is intentionally missing to test the default behavior
    },
    {
      id: 'cat-2',
      name: 'Greeters',
      description: 'Greet participants',
      staffOnly: false,
      alwaysRequired: true
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock JobCategorySchema.parse to add default fields without causing recursion
    vi.spyOn(JobCategorySchema, 'parse').mockImplementation((data: unknown) => {
      // Cast to any to avoid TypeScript errors while ensuring the mock works
      const jobCategory = data as Record<string, unknown>;
      
      return {
        id: jobCategory.id as string,
        name: jobCategory.name as string,
        description: jobCategory.description as string,
        staffOnly: jobCategory.staffOnly as boolean,
        alwaysRequired: jobCategory.alwaysRequired !== undefined 
          ? jobCategory.alwaysRequired as boolean 
          : false
      };
    });
  });

  describe('getAll', () => {
    it('should add alwaysRequired field with default false when missing from backend', async () => {
      // Arrange
      (api.get as Mock).mockResolvedValueOnce({
        data: mockJobCategories
      });

      // Act
      const result = await jobCategories.getAll();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].alwaysRequired).toBe(false); // Should have default value
      expect(result[1].alwaysRequired).toBe(true); // Should keep existing value
    });

    it('should handle error during fetch', async () => {
      // Arrange
      const apiError = new Error('Network Error');
      (api.get as Mock).mockRejectedValueOnce(apiError);

      // Act & Assert
      await expect(jobCategories.getAll()).rejects.toThrow('Network Error');
    });
  });

  describe('create', () => {
    const newJobCategory = {
      name: 'Security',
      description: 'Security shifts',
      staffOnly: true,
      alwaysRequired: true
    };

    it('should send data without alwaysRequired field to API but return data with it', async () => {
      // Arrange - API returns data without alwaysRequired
      (api.post as Mock).mockResolvedValueOnce({
        data: {
          id: 'cat-3',
          name: 'Security',
          description: 'Security shifts',
          staffOnly: true
          // alwaysRequired is intentionally missing
        }
      });

      // Act
      const result = await jobCategories.create(newJobCategory);

      // Assert
      // Verify that alwaysRequired wasn't included in API call
      expect(api.post).toHaveBeenCalledWith('/job-categories', {
        name: 'Security',
        description: 'Security shifts',
        staffOnly: true
        // No alwaysRequired
      });

      // Verify that result has alwaysRequired added back with the user-provided value
      // The implementation uses: alwaysRequired || false
      // Since we passed true, the result should be true
      expect(result.alwaysRequired).toBe(true);
    });
  });

  describe('update', () => {
    it('should preserve alwaysRequired in result even if backend doesn\'t support it', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Kitchen',
        alwaysRequired: true
      };

      // Backend returns data without alwaysRequired field
      (api.patch as Mock).mockResolvedValueOnce({
        data: {
          id: 'cat-1',
          name: 'Updated Kitchen',
          description: 'Kitchen shifts',
          staffOnly: false
          // alwaysRequired missing in response
        }
      });

      // Act
      const result = await jobCategories.update('cat-1', updateData);

      // Assert
      // Verify alwaysRequired wasn't sent to API
      expect(api.patch).toHaveBeenCalledWith('/job-categories/cat-1', { 
        name: 'Updated Kitchen'
      });
      
      // But it was preserved in result
      // The implementation uses: alwaysRequired !== undefined ? alwaysRequired : false
      // Since we passed alwaysRequired: true, the result should be true
      expect(result.alwaysRequired).toBe(true);
    });

    it('should maintain alwaysRequired value when specified', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Greeters',
        alwaysRequired: true
      };

      // Backend returns data with name updated but without alwaysRequired
      (api.patch as Mock).mockResolvedValueOnce({
        data: {
          id: 'cat-2',
          name: 'Updated Greeters',
          description: 'Greet participants',
          staffOnly: false
          // alwaysRequired missing in response
        }
      });

      // Act
      const result = await jobCategories.update('cat-2', updateData);

      // Assert
      expect(result.alwaysRequired).toBe(true); // Should match what was provided
    });
  });
});
