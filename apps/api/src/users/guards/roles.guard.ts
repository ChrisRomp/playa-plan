import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

/**
 * Key for storing roles metadata
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for an endpoint
 * @param roles - Array of roles that can access the endpoint
 */
export const Roles = (...roles: UserRole[]) => {
  return (target: any, key?: string, descriptor?: any) => {
    const reflector = new Reflector();
    reflector.set(ROLES_KEY, roles, descriptor.value);
    return descriptor;
  };
};

/**
 * Guard that checks if the user has any of the required roles
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Checks if the request can activate the handler
   * @param context - The execution context
   * @returns True if the user has the required role, false otherwise
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    // If no user is present, deny access
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user role is in the required roles
    // Admin role has access to everything
    if (user.role === UserRole.ADMIN || requiredRoles.includes(user.role)) {
      return true;
    }

    throw new ForbiddenException('Insufficient privileges');
  }
}