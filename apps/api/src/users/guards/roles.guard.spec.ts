import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);

    // Create a mock execution context
    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({})
      }),
      getHandler: jest.fn(),
      getClass: jest.fn()
    } as unknown as ExecutionContext;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles are required', () => {
    // Setup reflector to return no roles
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    
    // Call the guard
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow access when user has required role', () => {
    // Setup reflector to return required roles
    jest.spyOn(reflector, 'get').mockReturnValue([UserRole.STAFF]);
    
    // Setup context with authenticated user
    const request = { user: { role: UserRole.STAFF } };
    jest.spyOn(mockContext.switchToHttp(), 'getRequest').mockReturnValue(request);
    
    // Call the guard
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow access to admins regardless of required roles', () => {
    // Setup reflector to return required roles that don't include ADMIN
    jest.spyOn(reflector, 'get').mockReturnValue([UserRole.PARTICIPANT]);
    
    // Setup context with admin user
    const request = { user: { role: UserRole.ADMIN } };
    jest.spyOn(mockContext.switchToHttp(), 'getRequest').mockReturnValue(request);
    
    // Call the guard - should allow access because user is ADMIN
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should deny access when user does not have required role', () => {
    // Setup reflector to return required roles
    jest.spyOn(reflector, 'get').mockReturnValue([UserRole.ADMIN, UserRole.STAFF]);
    
    // Setup context with participant user
    const request = { user: { role: UserRole.PARTICIPANT } };
    jest.spyOn(mockContext.switchToHttp(), 'getRequest').mockReturnValue(request);
    
    // Call the guard - should throw ForbiddenException
    expect(() => guard.canActivate(mockContext)).toThrow('Insufficient privileges');
  });

  it('should deny access when no user is present', () => {
    // Setup reflector to return required roles
    jest.spyOn(reflector, 'get').mockReturnValue([UserRole.PARTICIPANT]);
    
    // Setup context with no user
    const request = {};
    jest.spyOn(mockContext.switchToHttp(), 'getRequest').mockReturnValue(request);
    
    // Call the guard - should throw ForbiddenException
    expect(() => guard.canActivate(mockContext)).toThrow('Authentication required');
  });
});