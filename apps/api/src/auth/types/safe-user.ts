import { Prisma } from '@prisma/client';
import { Request } from 'express';

/**
 * Prisma select object that excludes auth credentials and tokens.
 * Used by JwtStrategy to ensure auth-internal fields (password, tokens, codes)
 * never appear on req.user. Note: this still includes PII (phone, emergency
 * contact, etc.) which is needed for profile functionality.
 *
 * When adding new fields to the User model, add them here unless they are
 * auth secrets (passwords, tokens, codes, expiries).
 */
export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  playaName: true,
  profilePicture: true,
  role: true,
  isEmailVerified: true,
  phone: true,
  city: true,
  stateProvince: true,
  country: true,
  emergencyContact: true,
  allowDeferredDuesPayment: true,
  allowEarlyRegistration: true,
  allowNoJob: true,
  allowRegistration: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

/** User object safe for attachment to req.user — no auth secrets */
export type SafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_USER_SELECT }>;

/** Express request with an authenticated SafeUser on req.user */
export interface AuthenticatedRequest extends Request {
  user: SafeUser;
}
