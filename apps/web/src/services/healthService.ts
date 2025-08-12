import { api } from '../lib/api';
import { HealthStatus, HealthCheckResult, ClientInfo, FrontendHealthResponse } from '../types/health';

class HealthService {
  async getHealthStatus(): Promise<FrontendHealthResponse> {
    try {
      const [apiResult, clientResult, routingResult, assetsResult] = await Promise.allSettled([
        this.checkApiConnectivity(),
        this.checkClientCapabilities(),
        this.checkRoutingSystem(),
        this.checkAssetLoading(),
      ]);

      const checks = {
        api: this.extractResult(apiResult) as HealthCheckResult,
        client: this.extractResult(clientResult) as ClientInfo,
        routing: this.extractResult(routingResult) as HealthCheckResult,
        assets: this.extractResult(assetsResult) as HealthCheckResult,
      };

      const overallStatus = this.determineOverallStatus([
        checks.api,
        checks.client,
        checks.routing,
        checks.assets,
      ]);

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks,
      };
    } catch (error) {
      console.error('Frontend health check failed:', error);
      return {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date().toISOString(),
        checks: {
          api: { status: HealthStatus.UNHEALTHY, responseTime: '0ms', error: 'Health check failed' },
          client: {
            status: HealthStatus.UNHEALTHY,
            userAgent: 'unknown',
            performanceSupported: false,
            cookiesEnabled: false,
            localStorageEnabled: false,
          },
          routing: { status: HealthStatus.UNHEALTHY, responseTime: '0ms', error: 'Health check failed' },
          assets: { status: HealthStatus.UNHEALTHY, responseTime: '0ms', error: 'Health check failed' },
        },
      };
    }
  }

  private async checkApiConnectivity(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await Promise.race([
        api.get('/health'),
        this.timeoutPromise(5000, 'API connectivity timeout'),
      ]);

      const responseTime = `${Date.now() - startTime}ms`;
      return {
        status: HealthStatus.HEALTHY,
        responseTime,
      };
    } catch (error) {
      const responseTime = `${Date.now() - startTime}ms`;
      console.warn('API connectivity check failed:', error);
      return {
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: 'API connectivity failed',
      };
    }
  }

  private checkClientCapabilities(): ClientInfo {
    let status = HealthStatus.HEALTHY;
    const issues: string[] = [];

    // Check browser capabilities
    const performanceSupported = 'performance' in window && 'timing' in performance;
    const cookiesEnabled = navigator.cookieEnabled;
    const localStorageEnabled = this.checkLocalStorage();

    if (!cookiesEnabled) {
      status = HealthStatus.DEGRADED;
      issues.push('cookies disabled');
    }

    if (!localStorageEnabled) {
      status = HealthStatus.DEGRADED;
      issues.push('localStorage unavailable');
    }

    // Extract basic user agent info without sensitive details
    const userAgent = this.getSafeUserAgent();

    return {
      status,
      userAgent,
      performanceSupported,
      cookiesEnabled,
      localStorageEnabled,
    };
  }

  private async checkRoutingSystem(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check if routing system is functional by testing route resolution
      const currentPath = window.location.pathname;
      const isValidPath = currentPath.startsWith('/');

      if (!isValidPath) {
        throw new Error('Invalid route path');
      }

      // Check if history API is available
      if (!window.history || !window.history.pushState) {
        throw new Error('History API unavailable');
      }

      const responseTime = `${Date.now() - startTime}ms`;
      return {
        status: HealthStatus.HEALTHY,
        responseTime,
      };
    } catch (error) {
      const responseTime = `${Date.now() - startTime}ms`;
      console.warn('Routing system check failed:', error);
      return {
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: 'Routing system failed',
      };
    }
  }

  private async checkAssetLoading(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check if critical assets are loaded
      const styles = document.styleSheets;
      const scripts = document.scripts;

      if (styles.length === 0) {
        throw new Error('No stylesheets loaded');
      }

      if (scripts.length === 0) {
        throw new Error('No scripts loaded');
      }

      // Check if document is fully loaded
      if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
        return {
          status: HealthStatus.DEGRADED,
          responseTime: `${Date.now() - startTime}ms`,
          error: 'Document still loading',
        };
      }

      const responseTime = `${Date.now() - startTime}ms`;
      return {
        status: HealthStatus.HEALTHY,
        responseTime,
      };
    } catch (error) {
      const responseTime = `${Date.now() - startTime}ms`;
      console.warn('Asset loading check failed:', error);
      return {
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: 'Asset loading failed',
      };
    }
  }

  private checkLocalStorage(): boolean {
    try {
      const testKey = '__health_check_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private getSafeUserAgent(): string {
    const userAgent = navigator.userAgent;
    
    // Extract only basic browser info, remove potentially sensitive details
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
    const osMatch = userAgent.match(/(Windows|Macintosh|Linux|Android|iOS)/);
    
    const browser = browserMatch ? browserMatch[0] : 'unknown';
    const os = osMatch ? osMatch[1] : 'unknown';
    
    return `${browser} on ${os}`;
  }

  private timeoutPromise<T>(ms: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private extractResult(settledResult: PromiseSettledResult<HealthCheckResult | ClientInfo>): HealthCheckResult | ClientInfo {
    if (settledResult.status === 'fulfilled') {
      return settledResult.value;
    } else {
      return {
        status: HealthStatus.UNHEALTHY,
        responseTime: '0ms',
        error: settledResult.reason?.message || 'Unknown error',
      };
    }
  }

  private determineOverallStatus(checks: Array<{ status: HealthStatus }>): HealthStatus {
    const statuses = checks.map(check => check.status);

    if (statuses.some(status => status === HealthStatus.UNHEALTHY)) {
      return HealthStatus.UNHEALTHY;
    }

    if (statuses.some(status => status === HealthStatus.DEGRADED)) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }
}

export const healthService = new HealthService();