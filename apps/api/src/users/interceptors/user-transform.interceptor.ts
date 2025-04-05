import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User } from '../entities/user.entity';
import { User as PrismaUser } from '@prisma/client';
import { instanceToPlain } from 'class-transformer';

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
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
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
   * @returns Transformed User entity instance
   */
  private transformUser(user: PrismaUser | User): User | any {
    // Skip transformation if already a User instance
    if (user instanceof User) {
      return instanceToPlain(user); // Apply class-transformer exclusions
    }

    // Skip if not a user object
    if (!user || !('email' in user)) {
      return user;
    }

    // Transform to User entity and apply class-transformer exclusions
    const userEntity = new User(user);
    return instanceToPlain(userEntity);
  }
}