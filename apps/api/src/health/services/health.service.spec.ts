import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HealthStatus } from '../dto/health-response.dto';

describe('HealthService', () => {
  let service: HealthService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all checks pass', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockConfigService.get
        .mockReturnValueOnce({ secretKey: 'test-stripe-key' })
        .mockReturnValueOnce({ clientId: 'test-paypal-id' })
        .mockReturnValueOnce('https://api.paypal.com')
        .mockReturnValueOnce({ host: 'smtp.test.com' });

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
      mockConfigService.get
        .mockReturnValueOnce({ secretKey: 'test-stripe-key' })
        .mockReturnValueOnce({ clientId: 'test-paypal-id' })
        .mockReturnValueOnce('https://api.paypal.com')
        .mockReturnValueOnce({ host: 'smtp.test.com' });

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
      mockConfigService.get
        .mockReturnValueOnce({ secretKey: 'test-stripe-key' })
        .mockReturnValueOnce({ clientId: 'test-paypal-id' })
        .mockReturnValueOnce('https://api.paypal.com')
        .mockReturnValueOnce({ host: 'smtp.test.com' });

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
      mockConfigService.get
        .mockReturnValueOnce({ secretKey: 'test-stripe-key' })
        .mockReturnValueOnce({ clientId: 'test-paypal-id' })
        .mockReturnValueOnce('https://api.paypal.com')
        .mockReturnValueOnce(null);

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 401 });

      const actualResult = await service.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.email.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.email.error).toBe('Email service not configured');
    });

    it('should handle timeouts gracefully', async () => {
      mockPrismaService.$queryRaw.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000))
      );
      mockConfigService.get
        .mockReturnValueOnce({ secretKey: 'test-stripe-key' })
        .mockReturnValueOnce({ clientId: 'test-paypal-id' })
        .mockReturnValueOnce('https://api.paypal.com')
        .mockReturnValueOnce({ host: 'smtp.test.com' });

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 401 });

      const actualResult = await service.getHealthStatus();

      expect(actualResult.checks.database.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.database.error).toBe('Database connectivity failed');
    });

    it('should include system metrics', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockConfigService.get.mockReturnValue(null);

      const actualResult = await service.getHealthStatus();

      expect(actualResult.checks.system.memoryUsage).toMatch(/\d+%/);
      expect(actualResult.checks.system.uptime).toMatch(/\d+[dhm]/);
      expect(actualResult.checks.system.status).toBeDefined();
    });
  });
});