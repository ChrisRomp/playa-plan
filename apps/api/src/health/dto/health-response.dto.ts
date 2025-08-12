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

export interface SystemInfo {
  status: HealthStatus;
  memoryUsage: string;
  uptime: string;
}

export interface HealthResponseDto {
  status: HealthStatus;
  timestamp: string;
  checks: {
    database: HealthCheckResult;
    payments: HealthCheckResult;
    email: HealthCheckResult;
    system: SystemInfo;
  };
}