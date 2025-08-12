import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HealthCheckPage from '../HealthCheckPage';
import { healthService } from '../../services/healthService';
import { HealthStatus, FrontendHealthResponse } from '../../types/health';

// Mock the health service
vi.mock('../../services/healthService', () => ({
  healthService: {
    getHealthStatus: vi.fn(),
  },
}));

describe('HealthCheckPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document title
    document.title = 'Test';
  });

  it('should render loading state initially', () => {
    vi.mocked(healthService.getHealthStatus).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(<HealthCheckPage />);

    expect(screen.getByTestId('health-loading')).toBeInTheDocument();
    expect(screen.getByText('Status: CHECKING')).toBeInTheDocument();
  });

  it('should render healthy status correctly', async () => {
    const mockHealthData = {
      status: HealthStatus.HEALTHY,
      timestamp: '2023-01-01T00:00:00.000Z',
      checks: {
        api: { status: HealthStatus.HEALTHY, responseTime: '100ms' },
        client: {
          status: HealthStatus.HEALTHY,
          userAgent: 'Test Browser',
          cookiesEnabled: true,
          localStorageEnabled: true,
          performanceSupported: true,
        },
        routing: { status: HealthStatus.HEALTHY, responseTime: '5ms' },
        assets: { status: HealthStatus.HEALTHY, responseTime: '10ms' },
      },
    };

    vi.mocked(healthService.getHealthStatus).mockResolvedValue(mockHealthData);

    render(<HealthCheckPage />);

    await waitFor(() => {
      expect(screen.getByTestId('health-check')).toBeInTheDocument();
    });

    expect(screen.getByText('Overall Status: HEALTHY')).toBeInTheDocument();
    expect(screen.getByText(/Timestamp: 2023-01-01T00:00:00.000Z/)).toBeInTheDocument();
    expect(screen.getByTestId('api-status')).toHaveTextContent('API: HEALTHY (100ms)');
    expect(screen.getByTestId('client-status')).toHaveTextContent('Client: HEALTHY');
    expect(screen.getByTestId('routing-status')).toHaveTextContent('Routing: HEALTHY (5ms)');
    expect(screen.getByTestId('assets-status')).toHaveTextContent('Assets: HEALTHY (10ms)');
    expect(document.title).toBe('Health Check - OK');
  });

  it('should render unhealthy status correctly', async () => {
    const mockHealthData = {
      status: HealthStatus.UNHEALTHY,
      timestamp: '2023-01-01T00:00:00.000Z',
      checks: {
        api: { status: HealthStatus.UNHEALTHY, responseTime: '0ms', error: 'Connection failed' },
        client: {
          status: HealthStatus.HEALTHY,
          userAgent: 'Test Browser',
          cookiesEnabled: true,
          localStorageEnabled: true,
          performanceSupported: true,
        },
        routing: { status: HealthStatus.HEALTHY, responseTime: '5ms' },
        assets: { status: HealthStatus.HEALTHY, responseTime: '10ms' },
      },
    };

    vi.mocked(healthService.getHealthStatus).mockResolvedValue(mockHealthData);

    render(<HealthCheckPage />);

    await waitFor(() => {
      expect(screen.getByTestId('health-check')).toBeInTheDocument();
    });

    expect(screen.getByText('Overall Status: UNHEALTHY')).toBeInTheDocument();
    expect(screen.getByTestId('api-status')).toHaveTextContent('API: UNHEALTHY (0ms) - Connection failed');
    expect(document.title).toBe('Health Check - UNHEALTHY');
  });

  it('should render degraded status correctly', async () => {
    const mockHealthData = {
      status: HealthStatus.DEGRADED,
      timestamp: '2023-01-01T00:00:00.000Z',
      checks: {
        api: { status: HealthStatus.HEALTHY, responseTime: '100ms' },
        client: {
          status: HealthStatus.DEGRADED,
          userAgent: 'Test Browser',
          cookiesEnabled: false,
          localStorageEnabled: true,
          performanceSupported: true,
        },
        routing: { status: HealthStatus.HEALTHY, responseTime: '5ms' },
        assets: { status: HealthStatus.HEALTHY, responseTime: '10ms' },
      },
    };

    vi.mocked(healthService.getHealthStatus).mockResolvedValue(mockHealthData);

    render(<HealthCheckPage />);

    await waitFor(() => {
      expect(screen.getByTestId('health-check')).toBeInTheDocument();
    });

    expect(screen.getByText('Overall Status: DEGRADED')).toBeInTheDocument();
    expect(screen.getByTestId('client-status')).toHaveTextContent('Client: DEGRADED');
    expect(screen.getByText('Cookies: Disabled')).toBeInTheDocument();
    expect(screen.getByText('Local Storage: Available')).toBeInTheDocument();
    expect(document.title).toBe('Health Check - OK');
  });

  it('should render error state when health service fails', async () => {
    vi.mocked(healthService.getHealthStatus).mockRejectedValue(new Error('Service failed'));

    render(<HealthCheckPage />);

    await waitFor(() => {
      expect(screen.getByTestId('health-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Status: ERROR')).toBeInTheDocument();
    expect(screen.getByText('Error: Service failed')).toBeInTheDocument();
    expect(document.title).toBe('Health Check - ERROR');
  });

  it('should render no data state correctly', async () => {
    vi.mocked(healthService.getHealthStatus).mockResolvedValue(null as unknown as FrontendHealthResponse);

    render(<HealthCheckPage />);

    await waitFor(() => {
      expect(screen.getByTestId('health-no-data')).toBeInTheDocument();
    });

    expect(screen.getByText('Status: NO_DATA')).toBeInTheDocument();
  });

  it('should include client capabilities in display', async () => {
    const mockHealthData = {
      status: HealthStatus.HEALTHY,
      timestamp: '2023-01-01T00:00:00.000Z',
      checks: {
        api: { status: HealthStatus.HEALTHY, responseTime: '100ms' },
        client: {
          status: HealthStatus.HEALTHY,
          userAgent: 'Chrome/91.0 on Macintosh',
          cookiesEnabled: true,
          localStorageEnabled: false,
          performanceSupported: true,
        },
        routing: { status: HealthStatus.HEALTHY, responseTime: '5ms' },
        assets: { status: HealthStatus.HEALTHY, responseTime: '10ms' },
      },
    };

    vi.mocked(healthService.getHealthStatus).mockResolvedValue(mockHealthData);

    render(<HealthCheckPage />);

    await waitFor(() => {
      expect(screen.getByTestId('health-check')).toBeInTheDocument();
    });

    expect(screen.getByText('User Agent: Chrome/91.0 on Macintosh')).toBeInTheDocument();
    expect(screen.getByText('Cookies: Enabled')).toBeInTheDocument();
    expect(screen.getByText('Local Storage: Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Performance API: Supported')).toBeInTheDocument();
  });

  it('should set data attribute for status', async () => {
    const mockHealthData = {
      status: HealthStatus.DEGRADED,
      timestamp: '2023-01-01T00:00:00.000Z',
      checks: {
        api: { status: HealthStatus.HEALTHY, responseTime: '100ms' },
        client: {
          status: HealthStatus.DEGRADED,
          userAgent: 'Test Browser',
          cookiesEnabled: false,
          localStorageEnabled: true,
          performanceSupported: true,
        },
        routing: { status: HealthStatus.HEALTHY, responseTime: '5ms' },
        assets: { status: HealthStatus.HEALTHY, responseTime: '10ms' },
      },
    };

    vi.mocked(healthService.getHealthStatus).mockResolvedValue(mockHealthData);

    render(<HealthCheckPage />);

    await waitFor(() => {
      const healthCheck = screen.getByTestId('health-check');
      expect(healthCheck).toHaveAttribute('data-status', 'degraded');
    });
  });
});