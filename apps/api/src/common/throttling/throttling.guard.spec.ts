import { ExecutionContext } from '@nestjs/common';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlingGuard } from './throttling.guard';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

// Test-only subclass that exposes protected methods for testing
class TestableThrottlingGuard extends ThrottlingGuard {
  public getTrackingKeyTest(context: ExecutionContext): string {
    return this.getTrackingKey(context);
  }
  
  public async shouldThrottleTest(context: ExecutionContext): Promise<boolean> {
    return this.shouldThrottle(context);
  }
  
  public getThrottlerNameTest(context: ExecutionContext): string {
    return this.getThrottlerName(context);
  }
}

describe('ThrottlingGuard', () => {
  let guard: TestableThrottlingGuard;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStorageService: any;
  let mockOptions: ThrottlerModuleOptions;
  let mockReflector: Reflector;
  
  const mockExecutionContext = (): ExecutionContext => {
    const mockRequest = {
      ip: '127.0.0.1',
      method: 'POST',
      path: '/api/users',
      user: { id: 'test-user-id' }
    };
    
    const mockHttpArgumentsHost = {
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue({}),
    };
    
    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpArgumentsHost),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    
    return mockContext;
  };
  
  beforeEach(async () => {
    // Mock throttler options
    mockOptions = {
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 300,
        },
        {
          name: 'auth',
          ttl: 60000,
          limit: 30,
        },
      ],
    };
    
    // Mock storage service that tracks rate limiting
    mockStorageService = {
      increment: jest.fn().mockResolvedValue({ totalHits: 1 }),
      getRecord: jest.fn().mockResolvedValue({ totalHits: 1 }),
    };
    
    // Mock reflector
    mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(null),
      getAllAndMerge: jest.fn().mockReturnValue([]),
      get: jest.fn().mockReturnValue(null),
    } as unknown as Reflector;
    
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        ThrottlerModule.forRoot(mockOptions),
      ],
      providers: [
        {
          provide: TestableThrottlingGuard,
          useFactory: () => new TestableThrottlingGuard(
            mockOptions,
            mockStorageService,
            mockReflector, 
          ),
        },
      ],
    }).compile();
    
    guard = module.get<TestableThrottlingGuard>(TestableThrottlingGuard);
  });
  
  it('should be defined', () => {
    expect(guard).toBeDefined();
  });
  
  it('should use user ID as tracking key when available', async () => {
    // Arrange
    const context = mockExecutionContext();
    
    // Act
    const trackingKey = guard.getTrackingKeyTest(context);
    
    // Assert
    expect(trackingKey).toBe('user_test-user-id');
  });
  
  it('should use IP as tracking key when user is not authenticated', async () => {
    // Arrange
    const context = mockExecutionContext();
    const request = context.switchToHttp().getRequest();
    request.user = undefined;
    
    // Act
    const trackingKey = guard.getTrackingKeyTest(context);
    
    // Assert
    expect(trackingKey).toBe('127.0.0.1');
  });
  
  it('should skip throttling for health check endpoints', async () => {
    // Arrange
    const context = mockExecutionContext();
    const request = context.switchToHttp().getRequest();
    request.path = '/api/health';
    
    // Act
    const shouldThrottle = await guard.shouldThrottleTest(context);
    
    // Assert
    expect(shouldThrottle).toBe(false);
  });
  
  it('should apply auth throttler for authentication endpoints', async () => {
    // Arrange
    const context = mockExecutionContext();
    const request = context.switchToHttp().getRequest();
    request.path = '/auth/login';
    request.method = 'POST';
    
    // Act
    const throttlerName = guard.getThrottlerNameTest(context);
    
    // Assert
    expect(throttlerName).toBe('auth');
  });
  
  it('should apply default throttler for regular endpoints', async () => {
    // Arrange
    const context = mockExecutionContext();
    
    // Act
    const throttlerName = guard.getThrottlerNameTest(context);
    
    // Assert
    expect(throttlerName).toBe('default');
  });
  
  it('should skip throttling for GET requests when configured', async () => {
    // Arrange
    const ignoreGetRequests = true;
    const customGuard = new TestableThrottlingGuard(
      mockOptions,
      mockStorageService,
      mockReflector,
      ignoreGetRequests
    );
    
    const context = mockExecutionContext();
    const request = context.switchToHttp().getRequest();
    request.method = 'GET';
    
    // Act
    const shouldThrottle = await customGuard.shouldThrottleTest(context);
    
    // Assert
    expect(shouldThrottle).toBe(false);
  });
});