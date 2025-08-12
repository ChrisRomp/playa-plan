export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface HealthCheckResult {
  status: HealthStatus;
  responseTime: string;
  error?: string;
}

export interface ClientInfo {
  status: HealthStatus;
  userAgent: string;
  performanceSupported: boolean;
  cookiesEnabled: boolean;
  localStorageEnabled: boolean;
}

export interface FrontendHealthResponse {
  status: HealthStatus;
  timestamp: string;
  checks: {
    api: HealthCheckResult;
    client: ClientInfo;
    routing: HealthCheckResult;
    assets: HealthCheckResult;
  };
}