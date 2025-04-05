import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Guard that ensures a user can only access or modify their own profile
 * unless they are an admin or staff member
 */
@Injectable()
export class SelfOrAdminGuard implements CanActivate {
  /**
   * Checks if the request can activate the handler
   * @param context - The execution context
   * @returns True if user is accessing their own profile or has admin/staff role
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userId = request.params.id;

    // If no user is authenticated, deny access
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Allow admins to access any profile
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Allow staff to access participant profiles
    if (user.role === UserRole.STAFF) {
      // For staff, we would need to check if the target user is a participant
      // This requires a database lookup which we should avoid in guards if possible
      // Instead, we'll handle this check in the controller
      return true;
    }

    // Allow users to access their own profile
    if (user.id === userId) {
      return true;
    }

    throw new ForbiddenException('You can only access your own profile');
  }
}