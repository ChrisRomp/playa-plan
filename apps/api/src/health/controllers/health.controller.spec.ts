import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from '../services/health.service';
import { HealthStatus } from '../dto/health-response.dto';
import { Response } from 'express';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthService = {
    getHealthStatus: jest.fn(),
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return 200 status for healthy system', async () => {
      const expectedHealthStatus = {
        status: HealthStatus.HEALTHY,
        timestamp: '2023-01-01T00:00:00.000Z',
        checks: {
          database: { status: HealthStatus.HEALTHY, responseTime: '10ms' },
          payments: { status: HealthStatus.HEALTHY, responseTime: '150ms' },
          email: { status: HealthStatus.HEALTHY, responseTime: '50ms' },
          system: { status: HealthStatus.HEALTHY, memoryUsage: '50%', uptime: '1h 30m' },
        },
      };

      mockHealthService.getHealthStatus.mockResolvedValue(expectedHealthStatus);

      const actualResult = await controller.getHealth(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedHealthStatus);
      expect(actualResult).toBe(mockResponse);
    });

    it('should return 200 status for degraded system', async () => {
      const expectedHealthStatus = {
        status: HealthStatus.DEGRADED,
        timestamp: '2023-01-01T00:00:00.000Z',
        checks: {
          database: { status: HealthStatus.HEALTHY, responseTime: '10ms' },
          payments: { status: HealthStatus.DEGRADED, responseTime: '150ms', error: 'Some services unavailable' },
          email: { status: HealthStatus.HEALTHY, responseTime: '50ms' },
          system: { status: HealthStatus.HEALTHY, memoryUsage: '50%', uptime: '1h 30m' },
        },
      };

      mockHealthService.getHealthStatus.mockResolvedValue(expectedHealthStatus);

      const actualResult = await controller.getHealth(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedHealthStatus);
      expect(actualResult).toBe(mockResponse);
    });

    it('should return 503 status for unhealthy system', async () => {
      const expectedHealthStatus = {
        status: HealthStatus.UNHEALTHY,
        timestamp: '2023-01-01T00:00:00.000Z',
        checks: {
          database: { status: HealthStatus.UNHEALTHY, responseTime: '0ms', error: 'Connection failed' },
          payments: { status: HealthStatus.HEALTHY, responseTime: '150ms' },
          email: { status: HealthStatus.HEALTHY, responseTime: '50ms' },
          system: { status: HealthStatus.HEALTHY, memoryUsage: '50%', uptime: '1h 30m' },
        },
      };

      mockHealthService.getHealthStatus.mockResolvedValue(expectedHealthStatus);

      const actualResult = await controller.getHealth(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedHealthStatus);
      expect(actualResult).toBe(mockResponse);
    });

    it('should call health service correctly', async () => {
      const expectedHealthStatus = {
        status: HealthStatus.HEALTHY,
        timestamp: '2023-01-01T00:00:00.000Z',
        checks: {
          database: { status: HealthStatus.HEALTHY, responseTime: '10ms' },
          payments: { status: HealthStatus.HEALTHY, responseTime: '150ms' },
          email: { status: HealthStatus.HEALTHY, responseTime: '50ms' },
          system: { status: HealthStatus.HEALTHY, memoryUsage: '50%', uptime: '1h 30m' },
        },
      };

      mockHealthService.getHealthStatus.mockResolvedValue(expectedHealthStatus);

      await controller.getHealth(mockResponse);

      expect(mockHealthService.getHealthStatus).toHaveBeenCalledTimes(1);
      expect(mockHealthService.getHealthStatus).toHaveBeenCalledWith();
    });
  });
});