import { z } from 'zod';

/**
 * Schema for User entity
 */
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
});

/**
 * User type derived from the schema
 */
export type User = z.infer<typeof UserSchema>;
export const UsersArraySchema = z.array(UserSchema);

/**
 * Schema for creating a new user
 */
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
});

/**
 * CreateUserDTO type derived from the schema
 */
export type CreateUserDTO = z.infer<typeof CreateUserSchema>;

/**
 * Schema for updating an existing user
 */
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
});

/**
 * UpdateUserDTO type derived from the schema
 */
export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>; 