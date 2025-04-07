import { api } from './client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  token: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordConfirm {
  token: string;
  password: string;
}

export const AuthService = {
  login: (credentials: LoginCredentials) => 
    api.post<AuthResponse>('/auth/login', credentials),
    
  register: (data: RegisterData) =>
    api.post<AuthResponse>('/auth/register', data),
    
  logout: () => {
    localStorage.removeItem('auth_token');
    return Promise.resolve();
  },
  
  forgotPassword: (data: ResetPasswordRequest) =>
    api.post<{ message: string }>('/auth/forgot-password', data),
    
  resetPassword: (data: ResetPasswordConfirm) =>
    api.post<{ message: string }>('/auth/reset-password', data),
    
  getCurrentUser: () =>
    api.get<AuthResponse['user']>('/auth/me'),
}; 