import { useState, useCallback, useEffect } from 'react';
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

  // Fetch all users
  const fetchUsers = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/users');
      const parsedUsers = UsersArraySchema.parse(response.data);
      setUsers(parsedUsers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred fetching users';
      setError(errorMessage);
    } finally {
      setLoading(false);
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
      return newUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred creating the user';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

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
      
      return updatedUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred updating the user';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

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
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred deleting the user';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

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