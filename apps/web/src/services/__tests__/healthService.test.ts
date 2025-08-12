import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { healthService } from '../healthService';
import { HealthStatus } from '../../types/health';
import { api } from '../../lib/api';

// Mock the API module
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

// Mock window objects
const mockWindow = {
  location: { pathname: '/' },
  history: { pushState: vi.fn() },
  performance: { timing: {} },
  navigator: { cookieEnabled: true, userAgent: 'Mozilla/5.0 (Test Browser)' },
  localStorage: {
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
};

Object.defineProperty(window, 'location', {
  value: mockWindow.location,
  writable: true,
});

Object.defineProperty(window, 'history', {
  value: mockWindow.history,
  writable: true,
});

Object.defineProperty(window, 'performance', {
  value: mockWindow.performance,
  writable: true,
});

Object.defineProperty(window, 'navigator', {
  value: mockWindow.navigator,
  writable: true,
  configurable: true,
});

Object.defineProperty(window, 'localStorage', {
  value: mockWindow.localStorage,
  writable: true,
});

// Mock document
Object.defineProperty(document, 'readyState', {
  value: 'complete',
  writable: true,
});

Object.defineProperty(document, 'styleSheets', {
  value: [{ href: 'test.css' }],
  writable: true,
});

Object.defineProperty(document, 'scripts', {
  value: [{ src: 'test.js' }],
  writable: true,
});

describe('HealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Ensure navigator.cookieEnabled returns true in tests
    Object.defineProperty(navigator, 'cookieEnabled', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock successful API call
      vi.mocked(api.get).mockResolvedValue({ status: 200, data: { status: 'healthy' } });

      const actualResult = await healthService.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.HEALTHY);
      expect(actualResult.checks.api.status).toBe(HealthStatus.HEALTHY);
      expect(actualResult.checks.client.status).toBe(HealthStatus.HEALTHY);
      expect(actualResult.checks.routing.status).toBe(HealthStatus.HEALTHY);
      expect(actualResult.checks.assets.status).toBe(HealthStatus.HEALTHY);
      expect(actualResult.timestamp).toBeDefined();
    });

    it('should return unhealthy status when API fails', async () => {
      // Mock API failure
      vi.mocked(api.get).mockRejectedValue(new Error('API failed'));

      const actualResult = await healthService.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.api.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.api.error).toBe('API connectivity failed');
    });

    it('should return degraded status when cookies are disabled', async () => {
      // Mock successful API but disabled cookies
      vi.mocked(api.get).mockResolvedValue({ status: 200, data: { status: 'healthy' } });
      Object.defineProperty(window, 'navigator', {
        value: { ...mockWindow.navigator, cookieEnabled: false },
        writable: true,
      });

      const actualResult = await healthService.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.client.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.client.cookiesEnabled).toBe(false);
    });

    it('should return degraded status when localStorage is unavailable', async () => {
      // Mock successful API but localStorage failure
      vi.mocked(api.get).mockResolvedValue({ status: 200, data: { status: 'healthy' } });
      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: vi.fn().mockImplementation(() => {
            throw new Error('Storage disabled');
          }),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const actualResult = await healthService.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.client.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.client.localStorageEnabled).toBe(false);
    });

    it('should return unhealthy status when routing system fails', async () => {
      // Mock successful API but broken routing (empty pathname)
      vi.mocked(api.get).mockResolvedValue({ status: 200, data: { status: 'healthy' } });
      Object.defineProperty(window, 'location', {
        value: { pathname: '' },
        writable: true,
      });

      const actualResult = await healthService.getHealthStatus();
      expect(actualResult.checks.routing.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.routing.error).toBe('Routing system failed');
    });

    it('should return unhealthy status when no assets are loaded', async () => {
      // Mock successful API but no assets
      vi.mocked(api.get).mockResolvedValue({ status: 200, data: { status: 'healthy' } });
      Object.defineProperty(document, 'styleSheets', {
        value: [],
        writable: true,
      });

      const actualResult = await healthService.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.assets.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.assets.error).toBe('Asset loading failed');
    });

    it('should handle API timeout gracefully', async () => {
      // Mock API timeout - simulate a request that gets aborted
      vi.mocked(api.get).mockImplementation(
        (url, config) => new Promise((resolve, reject) => {
          const timeout = setTimeout(() => resolve({ status: 200, data: { status: 'healthy' } }), 6000);
          
          // Handle abort signal if provided
          if (config?.signal) {
            config.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('AbortError'));
            });
          }
        })
      );

      const actualResult = await healthService.getHealthStatus();

      expect(actualResult.checks.api.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.api.error).toBe('API connectivity failed');
    });

    it('should include client information', async () => {
      vi.mocked(api.get).mockResolvedValue({ status: 200, data: { status: 'healthy' } });

      const actualResult = await healthService.getHealthStatus();

      // The getSafeUserAgent method extracts only browser and OS info, falls back to 'unknown'
      expect(actualResult.checks.client.userAgent).toBe('unknown on unknown');
      expect(actualResult.checks.client.cookiesEnabled).toBe(true);
      expect(actualResult.checks.client.localStorageEnabled).toBe(true);
      expect(actualResult.checks.client.performanceSupported).toBe(true);
    });

    it('should handle complete service failure gracefully', async () => {
      // Mock everything failing
      vi.mocked(api.get).mockRejectedValue(new Error('Complete failure'));
      Object.defineProperty(window, 'navigator', {
        value: { cookieEnabled: false, userAgent: 'Test Browser' },
        writable: true,
      });
      Object.defineProperty(document, 'styleSheets', {
        value: [],
        writable: true,
      });

      const actualResult = await healthService.getHealthStatus();

      expect(actualResult.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.api.status).toBe(HealthStatus.UNHEALTHY);
      expect(actualResult.checks.client.status).toBe(HealthStatus.DEGRADED);
      expect(actualResult.checks.assets.status).toBe(HealthStatus.UNHEALTHY);
    });
  });
});