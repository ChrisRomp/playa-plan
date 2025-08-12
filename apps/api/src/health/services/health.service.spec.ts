import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HealthStatus } from '../dto/health-response.dto';

describe('HealthService', () => {
  let service: HealthService;
  let memoryUsageSpy: jest.SpyInstance<NodeJS.MemoryUsage, []> | undefined;
  let uptimeSpy: jest.SpyInstance<number, []> | undefined;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const configValues: Record<string, unknown> = {};
  const mockConfigService = {
    get: jest.fn((key: string) => configValues[key]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);

  jest.clearAllMocks();
  for (const k of Object.keys(configValues)) delete configValues[k];
  jest.useRealTimers();

  // Default system metrics to a healthy state for deterministic tests
  memoryUsageSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
    rss: 100_000_000,
    heapTotal: 100_000_000,
    heapUsed: 40_000_000, // 40% usage
    external: 10_000_000,
    arrayBuffers: 5_000_000,
  } as unknown as NodeJS.MemoryUsage);
  uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(3600); // 1h
  });

  afterEach(() => {
    if (typeof global.fetch === 'function') {
      try {
        (global.fetch as jest.Mock).mockClear?.();
      } catch {
        /* ignore */
      }
    }
    delete (global as { fetch?: unknown }).fetch;
    jest.useRealTimers();
  memoryUsageSpy?.mockRestore();
  uptimeSpy?.mockRestore();
  });

  afterAll(() => {
    const timers = (service as unknown as { __timers?: NodeJS.Timeout[] }).__timers;
    if (timers) {
      for (const t of timers) clearTimeout(t);
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all checks pass', async () => {
  mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  // Stable key-based config mocks
  configValues['stripe.secretKey'] = 'test-stripe-key';
  configValues['paypal.clientId'] = 'test-paypal-id';
  configValues['paypal.baseUrl'] = 'https://api.paypal.com';
  configValues['email'] = { host: 'smtp.test.com' };

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 401 });

      const actualResult = await service.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.HEALTHY);
      expect(actualResult.checks.database.status).toBe(HealthStatus.HEALTHY);
      expect(actualResult.checks.payments.status).toBe(HealthStatus.HEALTHY);
      expect(actualResult.checks.email.status).toBe(HealthStatus.HEALTHY);
      expect(actualResult.checks.system.status).toBe(HealthStatus.HEALTHY);
      expect(actualResult.timestamp).toBeDefined();
    });

    it('should return unhealthy status when database fails', async () => {
  mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));
  configValues['stripe.secretKey'] = 'test-stripe-key';
  configValues['paypal.clientId'] = 'test-paypal-id';
  configValues['paypal.baseUrl'] = 'https://api.paypal.com';
  configValues['email'] = { host: 'smtp.test.com' };

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 401 });

      const actualResult = await service.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.database.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.database.error).toBe('Database connectivity failed');
    });

    it('should return degraded status when payment services partially fail', async () => {
  mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  configValues['stripe.secretKey'] = 'test-stripe-key';
  configValues['paypal.clientId'] = 'test-paypal-id';
  configValues['paypal.baseUrl'] = 'https://api.paypal.com';
  configValues['email'] = { host: 'smtp.test.com' };

      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Stripe failed'))
        .mockResolvedValueOnce({ ok: false, status: 401 });

      const actualResult = await service.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.payments.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.payments.error).toBe('Some payment services unavailable');
    });

    it('should return degraded status when email service is not configured', async () => {
  mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  configValues['stripe.secretKey'] = 'test-stripe-key';
  configValues['paypal.clientId'] = 'test-paypal-id';
  configValues['paypal.baseUrl'] = 'https://api.paypal.com';
  // Intentionally omit email config to simulate not configured

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 401 });

      const actualResult = await service.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.email.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.email.error).toBe('Email service not configured');
    });

    it('should handle timeouts gracefully', async () => {
  jest.useFakeTimers();
  mockPrismaService.$queryRaw.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5000)));
  configValues['stripe.secretKey'] = 'test-stripe-key';
  configValues['paypal.clientId'] = 'test-paypal-id';
  configValues['paypal.baseUrl'] = 'https://api.paypal.com';
  configValues['email'] = { host: 'smtp.test.com' };

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 401 });
  const healthPromise = service.getHealthStatus();
  jest.advanceTimersByTime(3100);
  const actualResult = await healthPromise;

      expect(actualResult.checks.database.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.database.error).toBe('Database connectivity failed');
    });

    it('should include system metrics', async () => {
  mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  // Return null for any config requests to force minimal environment
  mockConfigService.get.mockImplementation(() => null);

      const actualResult = await service.getHealthStatus();

      expect(actualResult.checks.system.memoryUsage).toMatch(/\d+%/);
      expect(actualResult.checks.system.uptime).toMatch(/\d+[dhm]/);
      expect(actualResult.checks.system.status).toBeDefined();
    });
  });
});