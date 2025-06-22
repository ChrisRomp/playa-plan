import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard for JWT authentication
 * Protects routes from unauthorized access
 * Can be bypassed with @Public() decorator
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Determines if the current request can activate the route
   * @param context Execution context
   * @returns Boolean indicating if the route can be activated
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Allow access to public routes without authentication
    if (isPublic) {
      return true;
    }

    // Use the parent AuthGuard to check for JWT token
    return super.canActivate(context);
  }

  /**
   * Handle unauthorized requests
   * @param err Error object from authentication process
   * @param user User object from successful authentication  
   * @param _info Additional info from authentication strategy
   * @param _context Execution context
   * @param _status Optional status
   * @returns User object if authentication succeeded
   * @throws UnauthorizedException if authentication failed
   */
  handleRequest<TUser = unknown>(
    err: unknown, 
    user: unknown, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _info: unknown, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ExecutionContext, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _status?: unknown
  ): TUser {
    // You can throw a custom exception here based on either "err" or "user" params
    if (err || !user) {
      throw err || new UnauthorizedException('You are not authorized to access this resource');
    }
    return user as TUser;
  }
}