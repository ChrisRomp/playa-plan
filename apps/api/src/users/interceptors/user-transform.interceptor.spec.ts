import { UserTransformInterceptor } from './user-transform.interceptor';
import { User } from '../entities/user.entity';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { UserRole } from '@prisma/client';

describe('UserTransformInterceptor', () => {
  let interceptor: UserTransformInterceptor;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  
  beforeEach(() => {
    interceptor = new UserTransformInterceptor();
    mockContext = {} as ExecutionContext;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should transform a single user object to a plain object with excluded fields', (done) => {
    // Mock user from database (similar to Prisma User)
    const mockPrismaUser = {
      id: '1',
      email: 'test@example.playaplan.app',
      firstName: 'Test',
      lastName: 'User',
      password: 'hashedPassword123',
      playaName: 'Dusty',
      profilePicture: null,
      role: UserRole.PARTICIPANT,
      isEmailVerified: false,
      verificationToken: 'token123',
      resetToken: 'resetToken123',
      resetTokenExpiry: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Setup call handler to return our test data
    mockCallHandler = {
      handle: () => of(mockPrismaUser)
    };

    // Test interceptor transforms data
    interceptor.intercept(mockContext, mockCallHandler).subscribe(result => {
      // Type assertion to handle the interceptor's return type
      const transformedUser = result as Record<string, unknown>;
      
      // Check it's a plain object, not a User entity instance (after instanceToPlain)
      expect(typeof transformedUser).toBe('object');
      expect(transformedUser).not.toBeInstanceOf(User);
      
      // Check properties are preserved
      expect(transformedUser.id).toBe(mockPrismaUser.id);
      expect(transformedUser.email).toBe(mockPrismaUser.email);
      expect(transformedUser.firstName).toBe(mockPrismaUser.firstName);
      expect(transformedUser.lastName).toBe(mockPrismaUser.lastName);
      expect(transformedUser.playaName).toBe(mockPrismaUser.playaName);
      expect(transformedUser.role).toBe(mockPrismaUser.role);
      
      // Check sensitive fields are excluded
      expect(transformedUser.password).toBeUndefined();
      expect(transformedUser.verificationToken).toBeUndefined();
      expect(transformedUser.resetToken).toBeUndefined();
      expect(transformedUser.resetTokenExpiry).toBeUndefined();
      
      done();
    });
  });

  it('should transform an array of user objects with excluded fields', (done) => {
    // Mock array of users from database
    const mockPrismaUsers = [
      {
        id: '1',
        email: 'user1@example.playaplan.app',
        firstName: 'User',
        lastName: 'One',
        password: 'hashedPassword1',
        playaName: null,
        profilePicture: null,
        role: UserRole.PARTICIPANT,
        isEmailVerified: false,
        verificationToken: null,
        resetToken: null,
        resetTokenExpiry: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        email: 'user2@example.playaplan.app',
        firstName: 'User',
        lastName: 'Two',
        password: 'hashedPassword2',
        playaName: 'Ranger',
        profilePicture: null,
        role: UserRole.STAFF,
        isEmailVerified: true,
        verificationToken: null,
        resetToken: null,
        resetTokenExpiry: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Setup call handler to return our test data array
    mockCallHandler = {
      handle: () => of(mockPrismaUsers)
    };

    // Test interceptor transforms array data
    interceptor.intercept(mockContext, mockCallHandler).subscribe(result => {
      // Type assertion to handle the interceptor's return type for arrays
      const transformedUsers = result as Record<string, unknown>[];
      
      // Check we have an array with the right length
      expect(Array.isArray(transformedUsers)).toBe(true);
      expect(transformedUsers.length).toBe(2);
      
      // Check all items have expected properties and excluded fields
      transformedUsers.forEach((item: Record<string, unknown>, index: number) => {
        expect(typeof item).toBe('object');
        expect(item).not.toBeInstanceOf(User);
        expect(item.id).toBe(mockPrismaUsers[index].id);
        expect(item.email).toBe(mockPrismaUsers[index].email);
        expect(item.password).toBeUndefined();
        expect(item.verificationToken).toBeUndefined();
      });
      
      done();
    });
  });

  it('should not transform non-user objects', (done) => {
    const nonUserObject = { message: 'This is not a user' };
    
    mockCallHandler = {
      handle: () => of(nonUserObject)
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(result => {
      // Should return original object unchanged
      expect(result).toBe(nonUserObject);
      done();
    });
  });

  it('should return null/undefined values unchanged', (done) => {
    mockCallHandler = {
      handle: () => of(null)
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(result => {
      expect(result).toBeNull();
      done();
    });
  });

  it('should properly transform User entity instances', (done) => {
    // Create a User entity instance with sensitive data
    const userEntity = new User({
      id: '1',
      email: 'test@example.playaplan.app',
      firstName: 'Test',
      lastName: 'User',
      password: 'securePassword123',
      verificationToken: 'token123',
      resetToken: 'resetToken123'
    });
    
    mockCallHandler = {
      handle: () => of(userEntity)
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(result => {
      // Type assertion to handle the interceptor's return type
      const transformedUser = result as Record<string, unknown>;
      
      // Should be a plain object, not a User entity
      expect(typeof transformedUser).toBe('object');
      expect(transformedUser).not.toBeInstanceOf(User);
      expect(transformedUser.id).toBe(userEntity.id);
      expect(transformedUser.email).toBe(userEntity.email);
      
      // Check that sensitive fields are excluded
      expect(transformedUser.password).toBeUndefined();
      expect(transformedUser.verificationToken).toBeUndefined();
      expect(transformedUser.resetToken).toBeUndefined();
      
      done();
    });
  });
});