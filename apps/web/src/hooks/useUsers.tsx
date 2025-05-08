import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { z } from 'zod';

// Define User schema
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
  allowRegistration: z.boolean().optional(),
  allowEarlyRegistration: z.boolean().optional(),
  allowDeferredDuesPayment: z.boolean().optional(),
  allowNoJob: z.boolean().optional(),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  stateProvince: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

export type User = z.infer<typeof UserSchema>;
export const UsersArraySchema = z.array(UserSchema);

// Create User DTO schema
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string(),
  lastName: z.string(),
  playaName: z.string().optional(),
  role: z.enum(['ADMIN', 'STAFF', 'PARTICIPANT']).optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  country: z.string().optional(),
  emergencyContact: z.string().optional(),
  profilePicture: z.string().optional(),
  allowRegistration: z.boolean().optional(),
  allowEarlyRegistration: z.boolean().optional(),
  allowDeferredDuesPayment: z.boolean().optional(),
  allowNoJob: z.boolean().optional(),
  internalNotes: z.string().optional(),
});

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;

// Update User DTO schema
export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  playaName: z.string().optional(),
  role: z.enum(['ADMIN', 'STAFF', 'PARTICIPANT']).optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  country: z.string().optional(),
  emergencyContact: z.string().optional(),
  profilePicture: z.string().optional(),
  allowRegistration: z.boolean().optional(),
  allowEarlyRegistration: z.boolean().optional(),
  allowDeferredDuesPayment: z.boolean().optional(),
  allowNoJob: z.boolean().optional(),
  internalNotes: z.string().optional(),
});

export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;

interface UseUsersReturn {
  users: User[];
  loading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  getUser: (id: string) => Promise<User | null>;
  createUser: (user: CreateUserDTO) => Promise<User | null>;
  updateUser: (id: string, user: UpdateUserDTO) => Promise<User | null>;
  deleteUser: (id: string) => Promise<boolean>;
  selectedUser: User | null;
  setSelectedUser: (user: User | null) => void;
}

export function useUsers(): UseUsersReturn {
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