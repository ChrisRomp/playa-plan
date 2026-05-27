import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { User, UserSchema, UsersArraySchema, CreateUserDTO, UpdateUserDTO } from '../types/users';

/**
 * Hook for managing user data
 * Provides functions for fetching, creating, updating, and deleting users
 */
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const latestFetchRequestId = useRef(0);

  // Fetch all users
  const fetchUsers = useCallback(async (): Promise<void> => {
    const requestId = latestFetchRequestId.current + 1;
    latestFetchRequestId.current = requestId;

    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/users');
      const parsedUsers = UsersArraySchema.parse(response.data);

      if (requestId === latestFetchRequestId.current) {
        setUsers(parsedUsers);
      }
    } catch (err) {
      if (requestId === latestFetchRequestId.current) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred fetching users';
        setError(errorMessage);
      }
    } finally {
      if (requestId === latestFetchRequestId.current) {
        setLoading(false);
      }
    }
  }, []);

  // Get a specific user by ID
  const getUser = useCallback(async (id: string): Promise<User | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/users/${id}`);
      return UserSchema.parse(response.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred fetching the user';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new user
  const createUser = useCallback(async (userData: CreateUserDTO): Promise<User | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/users', userData);
      const newUser = UserSchema.parse(response.data);
      setUsers(prev => [...prev, newUser]);
      await fetchUsers();
      return newUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred creating the user';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  // Update an existing user
  const updateUser = useCallback(async (id: string, userData: UpdateUserDTO): Promise<User | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.put(`/users/${id}`, userData);
      const updatedUser = UserSchema.parse(response.data);
      setUsers(prev => prev.map(user => user.id === id ? updatedUser : user));
      
      // Update selected user if it's the one being edited
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser(updatedUser);
      }

      await fetchUsers();
      
      return updatedUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred updating the user';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, selectedUser]);

  // Delete a user
  const deleteUser = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/users/${id}`);
      setUsers(prev => prev.filter(user => user.id !== id));
      
      // Clear selected user if it's the one being deleted
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser(null);
      }

      await fetchUsers();
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred deleting the user';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, selectedUser]);

  // Load users on initial mount
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    fetchUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    selectedUser,
    setSelectedUser
  };
} 