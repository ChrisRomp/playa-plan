import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Key for roles metadata
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for an endpoint
 * @param roles - Array of roles that can access the endpoint
 * @returns Metadata decorator
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);