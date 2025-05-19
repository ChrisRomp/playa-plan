import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUsers } from './useUsers';
import { api } from '../lib/api';
import { User } from '../types/users';

// Mock the API
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useUsers', () => {
  const mockUsers: User[] = [
    {
      id: '1',
      email: 'test1@example.playaplan.app',
      firstName: 'Test',
      lastName: 'User1',
      role: 'PARTICIPANT',
      isEmailVerified: true,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    },
    {
      id: '2',
      email: 'test2@example.playaplan.app',
      firstName: 'Test',
      lastName: 'User2',
      role: 'ADMIN',
      isEmailVerified: true,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch users on mount', async () => {
    // Mock the API response
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockUsers });

    // Render the hook
    const { result } = renderHook(() => useUsers());

    // Wait for the effect to run
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify API was called
    expect(api.get).toHaveBeenCalledWith('/users');
    
    // Verify users were set
    expect(result.current.users).toEqual(mockUsers);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch users error', async () => {
    // Mock API error
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Failed to fetch'));

    // Render the hook
    const { result } = renderHook(() => useUsers());

    // Wait for the effect to run
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify error state
    expect(result.current.error).toBe('Failed to fetch');
    expect(result.current.users).toEqual([]);
  });

  it('should get a user by ID', async () => {
    const mockUser = mockUsers[0];
    
    // Set up the API mock response
    vi.mocked(api.get).mockResolvedValue({ data: mockUser });

    // Render the hook
    const { result } = renderHook(() => useUsers());

    // Call getUser within act
    let user;
    await act(async () => {
      user = await result.current.getUser('1');
    });

    // Verify API was called correctly
    expect(api.get).toHaveBeenCalledWith('/users/1');
    
    // Verify the user returned matches the mock data
    expect(user).toEqual(mockUser);
  });

  it('should create a new user', async () => {
    const newUserData = {
      email: 'new@example.playaplan.app',
      firstName: 'New',
      lastName: 'User',
      password: 'password123',
      role: 'PARTICIPANT',
    };

    const createdUser = {
      id: '3',
      email: 'new@example.playaplan.app',
      firstName: 'New',
      lastName: 'User',
      role: 'PARTICIPANT',
      isEmailVerified: false,
      createdAt: '2023-01-02',
      updatedAt: '2023-01-02',
    };

    // Set up the API mock response
    vi.mocked(api.post).mockResolvedValueOnce({ data: createdUser });

    // Render the hook
    const { result } = renderHook(() => useUsers());

    // Call createUser within act
    let user;
    await act(async () => {
      user = await result.current.createUser(newUserData);
    });

    // Verify API was called correctly
    expect(api.post).toHaveBeenCalledWith('/users', newUserData);
    
    // Verify the user was created and returned
    expect(user).toEqual(createdUser);
    
    // Verify the user was added to the list
    expect(result.current.users).toContainEqual(createdUser);
  });

  it('should update an existing user', async () => {
    const userId = '1';
    const updateData = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    const updatedUser = {
      ...mockUsers[0],
      firstName: 'Updated',
      lastName: 'Name',
      updatedAt: '2023-01-03',
    };

    // Set up the API mock response
    vi.mocked(api.put).mockResolvedValueOnce({ data: updatedUser });

    // Set up the initial API call for fetching users
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockUsers });

    // Render the hook
    const { result } = renderHook(() => useUsers());

    // Wait for initial data load
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Call updateUser within act
    let user;
    await act(async () => {
      user = await result.current.updateUser(userId, updateData);
    });

    // Verify API was called correctly
    expect(api.put).toHaveBeenCalledWith(`/users/${userId}`, updateData);
    
    // Verify the user was updated and returned
    expect(user).toEqual(updatedUser);
    
    // Verify the user was updated in the list
    const updatedUserInList = result.current.users.find(user => user.id === userId);
    expect(updatedUserInList).toEqual(updatedUser);
  });

  it('should delete a user', async () => {
    const userId = '1';
    
    // Set up the API mock response
    vi.mocked(api.delete).mockResolvedValueOnce({});

    // Set up the initial API call for fetching users
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockUsers });

    // Render the hook
    const { result } = renderHook(() => useUsers());
    
    // Wait for initial data load
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    // Verify we have the expected number of users before deletion
    expect(result.current.users.length).toBe(2);

    // Call deleteUser within act
    let success;
    await act(async () => {
      success = await result.current.deleteUser(userId);
    });

    // Verify API was called correctly
    expect(api.delete).toHaveBeenCalledWith(`/users/${userId}`);
    
    // Verify the operation was successful
    expect(success).toBe(true);
    
    // Verify the user was removed from the list
    expect(result.current.users).not.toContainEqual(mockUsers[0]);
    expect(result.current.users.length).toBe(1);
  });

  it('should handle getUser error', async () => {
    const errorMessage = 'Failed to fetch the user';
    
    // Clear any previous mock first, then mock API error
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockRejectedValue(new Error(errorMessage));
    
    // Render the hook
    const { result } = renderHook(() => useUsers());
    
    // Call the function under test
    let user = null;
    await act(async () => {
      user = await result.current.getUser('1');
    });
    
    // Verify the results
    expect(user).toBeNull();
    expect(result.current.error).toBe(errorMessage);
  });
  
  it('should handle createUser error', async () => {
    const errorMessage = 'Failed to create user';
    
    // Clear any previous mock first, then mock API error
    vi.mocked(api.post).mockReset();
    vi.mocked(api.post).mockRejectedValue(new Error(errorMessage));
    
    // Render the hook
    const { result } = renderHook(() => useUsers());
    
    // Call the function under test
    let user = null;
    await act(async () => {
      user = await result.current.createUser({ 
        email: 'test@example.playaplan.app', 
        firstName: 'Test', 
        lastName: 'User', 
        password: 'password123' 
      });
    });
    
    // Verify the results
    expect(user).toBeNull();
    expect(result.current.error).toBe(errorMessage);
  });
  
  it('should handle updateUser error', async () => {
    const errorMessage = 'Failed to update user';
    
    // Clear any previous mock first, then mock API error
    vi.mocked(api.put).mockReset();
    vi.mocked(api.put).mockRejectedValue(new Error(errorMessage));
    
    // Render the hook
    const { result } = renderHook(() => useUsers());
    
    // Call the function under test
    let user = null;
    await act(async () => {
      user = await result.current.updateUser('1', { firstName: 'Updated' });
    });
    
    // Verify the results
    expect(user).toBeNull();
    expect(result.current.error).toBe(errorMessage);
  });
  
  it('should handle deleteUser error', async () => {
    const errorMessage = 'Failed to delete user';
    
    // Clear any previous mock first, then mock API error
    vi.mocked(api.delete).mockReset();
    vi.mocked(api.delete).mockRejectedValue(new Error(errorMessage));
    
    // Render the hook
    const { result } = renderHook(() => useUsers());
    
    // Call the function under test
    let success;
    await act(async () => {
      success = await result.current.deleteUser('1');
    });
    
    // Verify the results
    expect(success).toBe(false);
    expect(result.current.error).toBe(errorMessage);
  });
}); 