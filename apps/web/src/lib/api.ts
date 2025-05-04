import axios from 'axios';
import { z } from 'zod';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// API client instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response schemas
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  playaName: z.string().optional(),
  profilePicture: z.string().optional(),
  role: z.enum(['ADMIN', 'STAFF', 'PARTICIPANT']),
  isEmailVerified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
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
  campDescription: z.string().optional(),
  homePageBlurb: z.string().optional(),
  campBannerUrl: z.string().optional(),
  campBannerAltText: z.string().optional(),
  campIconUrl: z.string().optional(),
  campIconAltText: z.string().optional(),
  registrationYear: z.number(),
  earlyRegistrationOpen: z.boolean(),
  registrationOpen: z.boolean(),
  registrationTerms: z.string().optional(),
  allowDeferredDuesPayment: z.boolean(),
  stripeEnabled: z.boolean(),
  stripePublicKey: z.string().optional(),
  paypalEnabled: z.boolean(),
  paypalClientId: z.string().optional(),
  paypalMode: z.enum(['sandbox', 'live']),
  timeZone: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// API Types
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type CoreConfig = z.infer<typeof CoreConfigSchema>;

// API Functions
export const auth = {
  login: async (email: string, password: string) => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    return AuthResponseSchema.parse(response.data);
  },
  
  register: async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    playaName?: string;
  }) => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return AuthResponseSchema.parse(response.data);
  },
  
  getProfile: async () => {
    const response = await api.get<User>('/auth/profile');
    return UserSchema.parse(response.data);
  },
};

export const config = {
  getCurrent: async () => {
    const response = await api.get<CoreConfig>('/core-config/current');
    return CoreConfigSchema.parse(response.data);
  },
};