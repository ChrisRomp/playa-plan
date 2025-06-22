 import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User } from '../entities/user.entity';
import { User as PrismaUser } from '@prisma/client';
import { instanceToPlain } from 'class-transformer';

/**
 * Type representing the transformed user data after class-transformer processing
 */
type TransformedUser = Record<string, unknown>;

/**
 * Type representing data that could be a user or array of users
 */
type UserResponseData = PrismaUser | User | PrismaUser[] | User[] | TransformedUser | TransformedUser[] | unknown;

/**
 * Interceptor to transform Prisma User objects into User entity instances
 * This ensures consistent serialization and exclusion of sensitive fields
 */
@Injectable()
export class UserTransformInterceptor implements NestInterceptor {
  /**
   * Intercept method to transform the response
   * @param context - The execution context
   * @param next - The call handler
   * @returns Observable with transformed response
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<UserResponseData> {
    return next.handle().pipe(
      map((data) => {
        // Skip transformation if no data
        if (!data) {
          return data;
        }

        // Transform array of users
        if (Array.isArray(data)) {
          return data.map(item => this.transformUser(item));
        }

        // Transform single user object
        return this.transformUser(data);
      }),
    );
  }

  /**
   * Transform a user object from database model to entity
   * @param user - User object from database or already transformed
   * @returns Transformed User entity instance or original data if not a user
   */
  private transformUser(user: PrismaUser | User | unknown): TransformedUser | unknown {
    // Skip transformation if already a User instance
    if (user instanceof User) {
      return instanceToPlain(user); // Apply class-transformer exclusions
    }

    // Handle non-user objects more reliably
    // First check if it's actually a user-like object (has email and other key user fields)
    if (!user || typeof user !== 'object' || 
        !('email' in user) || 
        !('firstName' in user) || 
        !('lastName' in user)) {
      return user;
    }

    // Type guard to ensure we have a proper user object
    const isUserLike = (obj: object): obj is Partial<PrismaUser> => {
      return 'email' in obj && 'firstName' in obj && 'lastName' in obj;
    };

    if (!isUserLike(user)) {
      return user;
    }

    // Transform to User entity and apply class-transformer exclusions
    const userEntity = new User(user);
    return instanceToPlain(userEntity);
  }
}