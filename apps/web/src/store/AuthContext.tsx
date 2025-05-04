import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {},
  logout: () => {},
  isLoading: false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string) => {
    setIsLoading(true);
    try {
      // Mock login - in a real application, this would call an API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate successful login with mock user data
      setUser({
        id: '1',
        name: 'John Doe',
        email,
        role: email.includes('admin') ? 'admin' : email.includes('staff') ? 'staff' : 'user',
        isAuthenticated: true,
        isEarlyRegistrationEnabled: true,
        hasRegisteredForCurrentYear: false
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};