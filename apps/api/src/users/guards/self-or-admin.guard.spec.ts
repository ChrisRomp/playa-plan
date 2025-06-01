import { SelfOrAdminGuard } from './self-or-admin.guard';
import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('SelfOrAdminGuard', () => {
  let guard: SelfOrAdminGuard;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    guard = new SelfOrAdminGuard();

    // Create a mock execution context
    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          params: { id: 'user-123' }
        })
      }),
      getHandler: jest.fn(),
      getClass: jest.fn()
    } as unknown as ExecutionContext;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when user is accessing their own profile', () => {
    // Setup context with user accessing their own profile
    const request = {
      user: { id: 'user-123', role: UserRole.PARTICIPANT },
      params: { id: 'user-123' }
    };
    
    jest.spyOn(mockContext.switchToHttp(), 'getRequest').mockReturnValue(request);
    
    // Call the guard - should allow access
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow access when user has ADMIN role', () => {
    // Setup context with admin user accessing someone else's profile
    const request = {
      user: { id: 'admin-123', role: UserRole.ADMIN },
      params: { id: 'user-123' }
    };
    
    jest.spyOn(mockContext.switchToHttp(), 'getRequest').mockReturnValue(request);
    
    // Call the guard - should allow access because user is ADMIN
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow access when user has STAFF role', () => {
    // Setup context with staff user accessing someone else's profile
    const request = {
      user: { id: 'staff-123', role: UserRole.STAFF },
      params: { id: 'user-123' }
    };
    
    jest.spyOn(mockContext.switchToHttp(), 'getRequest').mockReturnValue(request);
    
    // Call the guard - should allow access because user is STAFF
    // Note: The actual check for target user role will happen in the controller
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should deny access when user tries to access someone else\'s profile', () => {
    // Setup context with user accessing someone else's profile
    const request = {
      user: { id: 'user-456', role: UserRole.PARTICIPANT },
      params: { id: 'user-123' }
    };
    
    jest.spyOn(mockContext.switchToHttp(), 'getRequest').mockReturnValue(request);
    
    // Call the guard - should throw ForbiddenException
    expect(() => guard.canActivate(mockContext)).toThrow('You can only access your own profile');
  });

  it('should deny access when participant tries to access another participant\'s profile', () => {
    // Setup context with participant accessing another participant's profile
    const request = {
      user: { id: 'participant-one', role: UserRole.PARTICIPANT },
      params: { id: 'participant-two' }
    };
    
    jest.spyOn(mockContext.switchToHttp(), 'getRequest').mockReturnValue(request);
    
    // Call the guard - should throw ForbiddenException
    expect(() => guard.canActivate(mockContext)).toThrow('You can only access your own profile');
  });

  it('should deny access when no user is present', () => {
    // Setup context with no authenticated user
    const request = {
      params: { id: 'user-123' }
    };
    
    jest.spyOn(mockContext.switchToHttp(), 'getRequest').mockReturnValue(request);
    
    // Call the guard - should throw ForbiddenException
    expect(() => guard.canActivate(mockContext)).toThrow('Authentication required');
  });
});