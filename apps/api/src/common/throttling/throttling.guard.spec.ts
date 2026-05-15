import { ExecutionContext } from '@nestjs/common';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlingGuard } from './throttling.guard';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

// Test-only subclass that exposes protected v6 hooks for testing
class TestableThrottlingGuard extends ThrottlingGuard {
  public getTrackerTest(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }

  public shouldSkipTest(context: ExecutionContext): Promise<boolean> {
    return this.shouldSkip(context);
  }
}

describe('ThrottlingGuard', () => {
  let guard: TestableThrottlingGuard;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStorageService: any;
  let mockOptions: ThrottlerModuleOptions;
  let mockReflector: Reflector;

  const mockExecutionContext = (overrides: Record<string, unknown> = {}): ExecutionContext => {
    const mockRequest = {
      ip: '127.0.0.1',
      method: 'POST',
      path: '/api/users',
      user: { id: 'test-user-id' },
      ...overrides,
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
    mockOptions = {
      throttlers: [
        { name: 'default', ttl: 60000, limit: 300 },
        { name: 'auth', ttl: 60000, limit: 30 },
      ],
    };

    mockStorageService = {
      increment: jest.fn().mockResolvedValue({ totalHits: 1 }),
      getRecord: jest.fn().mockResolvedValue({ totalHits: 1 }),
    };

    mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(null),
      getAllAndMerge: jest.fn().mockReturnValue([]),
      get: jest.fn().mockReturnValue(null),
    } as unknown as Reflector;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
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

  it('should track authenticated requests by user ID', async () => {
    const req = { ip: '127.0.0.1', user: { id: 'test-user-id' } };
    await expect(guard.getTrackerTest(req)).resolves.toBe('user_test-user-id');
  });

  it('should track anonymous requests by IP', async () => {
    const req = { ip: '127.0.0.1' };
    await expect(guard.getTrackerTest(req)).resolves.toBe('127.0.0.1');
  });

  it('should fall back to "unknown" when neither user nor IP is available', async () => {
    await expect(guard.getTrackerTest({})).resolves.toBe('unknown');
  });

  it('should skip throttling for health check endpoints', async () => {
    const context = mockExecutionContext({ path: '/api/health' });
    await expect(guard.shouldSkipTest(context)).resolves.toBe(true);
  });

  it('should not skip throttling for regular endpoints', async () => {
    const context = mockExecutionContext();
    await expect(guard.shouldSkipTest(context)).resolves.toBe(false);
  });

  it('should skip GET requests when ignoreGetRequests is enabled', async () => {
    const customGuard = new TestableThrottlingGuard(
      mockOptions,
      mockStorageService,
      mockReflector,
      true,
    );
    const context = mockExecutionContext({ method: 'GET' });
    await expect(customGuard.shouldSkipTest(context)).resolves.toBe(true);
  });

  describe('isAuthenticationRequest', () => {
    const buildReq = (method: string, path: string) =>
      ({ method, path } as unknown as Parameters<typeof ThrottlingGuard.isAuthenticationRequest>[0]);

    it.each([
      ['POST', '/auth/login'],
      ['POST', '/auth/register'],
      ['POST', '/auth/request-login-code'],
      ['POST', '/auth/login-with-code'],
      ['POST', '/auth/passkey/options'],
      ['POST', '/auth/passkey/verify'],
    ])('classifies %s %s as an auth request', (method, path) => {
      expect(ThrottlingGuard.isAuthenticationRequest(buildReq(method, path))).toBe(true);
    });

    it('classifies non-auth POST as not an auth request', () => {
      expect(ThrottlingGuard.isAuthenticationRequest(buildReq('POST', '/users'))).toBe(false);
    });

    it('classifies GET on an auth path as not an auth request', () => {
      expect(ThrottlingGuard.isAuthenticationRequest(buildReq('GET', '/auth/login'))).toBe(false);
    });
  });
});