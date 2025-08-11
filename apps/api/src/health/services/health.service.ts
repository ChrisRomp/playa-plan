import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HealthStatus, HealthCheckResult, SystemInfo, HealthResponseDto } from '../dto/health-response.dto';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getHealthStatus(): Promise<HealthResponseDto> {
    
    try {
      const [databaseResult, paymentsResult, emailResult, systemResult] = 
        await Promise.allSettled([
          this.checkDatabase(),
          this.checkPaymentServices(),
          this.checkEmailService(),
          this.checkSystemHealth(),
        ]);

      const checks = {
        database: this.extractResult(databaseResult) as HealthCheckResult,
        payments: this.extractResult(paymentsResult) as HealthCheckResult,
        email: this.extractResult(emailResult) as HealthCheckResult,
        system: this.extractResult(systemResult) as SystemInfo,
      };

      const overallStatus = this.determineOverallStatus(Object.values(checks));
      
      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks,
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: HealthStatus.UNHEALTHY, responseTime: '0ms', error: 'Health check failed' },
          payments: { status: HealthStatus.UNHEALTHY, responseTime: '0ms', error: 'Health check failed' },
          email: { status: HealthStatus.UNHEALTHY, responseTime: '0ms', error: 'Health check failed' },
          system: { status: HealthStatus.UNHEALTHY, memoryUsage: 'unknown', uptime: 'unknown' },
        },
      };
    }
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        this.timeoutPromise(3000, 'Database check timeout'),
      ]);
      
      const responseTime = `${Date.now() - startTime}ms`;
      return {
        status: HealthStatus.HEALTHY,
        responseTime,
      };
    } catch (error) {
      const responseTime = `${Date.now() - startTime}ms`;
      this.logger.warn('Database health check failed', error);
      return {
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: 'Database connectivity failed',
      };
    }
  }

  private async checkPaymentServices(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const results = await Promise.allSettled([
        this.checkStripeHealth(),
        this.checkPayPalHealth(),
      ]);
      
      const responseTime = `${Date.now() - startTime}ms`;
      const hasFailures = results.some(result => result.status === 'rejected');
      
      if (hasFailures) {
        return {
          status: HealthStatus.DEGRADED,
          responseTime,
          error: 'Some payment services unavailable',
        };
      }
      
      return {
        status: HealthStatus.HEALTHY,
        responseTime,
      };
    } catch (error) {
      const responseTime = `${Date.now() - startTime}ms`;
      this.logger.warn('Payment services health check failed', error);
      return {
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: 'Payment services check failed',
      };
    }
  }

  private async checkStripeHealth(): Promise<void> {
    const stripeKey = this.configService.get<string>('stripe.secretKey');
    if (!stripeKey) {
      throw new Error('Stripe not configured');
    }
    
    await Promise.race([
      fetch('https://api.stripe.com/v1/account', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Stripe API returned ${response.status}`);
        }
      }),
      this.timeoutPromise(2000, 'Stripe API timeout'),
    ]);
  }

  private async checkPayPalHealth(): Promise<void> {
    const paypalClientId = this.configService.get<string>('paypal.clientId');
    if (!paypalClientId) {
      throw new Error('PayPal not configured');
    }
    
    const baseUrl = this.configService.get<string>('paypal.baseUrl');
    await Promise.race([
      fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
      }).then(response => {
        if (!response.ok && response.status !== 401) {
          throw new Error(`PayPal API returned ${response.status}`);
        }
      }),
      this.timeoutPromise(2000, 'PayPal API timeout'),
    ]);
  }

  private async checkEmailService(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const emailConfig = this.configService.get('email');
      if (!emailConfig) {
        return {
          status: HealthStatus.DEGRADED,
          responseTime: `${Date.now() - startTime}ms`,
          error: 'Email service not configured',
        };
      }
      
      return {
        status: HealthStatus.HEALTHY,
        responseTime: `${Date.now() - startTime}ms`,
      };
    } catch (error) {
      const responseTime = `${Date.now() - startTime}ms`;
      this.logger.warn('Email service health check failed', error);
      return {
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: 'Email service check failed',
      };
    }
  }

  private checkSystemHealth(): SystemInfo {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercent = Math.round((usedMemory / totalMemory) * 100);
    
    const uptime = process.uptime();
    const uptimeFormatted = this.formatUptime(uptime);
    
    // More conservative thresholds for containerized environments
    // Only mark unhealthy for extreme memory pressure that indicates actual problems
    let status = HealthStatus.HEALTHY;
    if (memoryPercent > 95) {
      status = HealthStatus.UNHEALTHY;
    } else if (memoryPercent > 90) {
      status = HealthStatus.DEGRADED;
    }
    
    return {
      status,
      memoryUsage: `${memoryPercent}%`,
      uptime: uptimeFormatted,
    };
  }

  private timeoutPromise<T>(ms: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private extractResult(settledResult: PromiseSettledResult<HealthCheckResult | SystemInfo>): HealthCheckResult | SystemInfo {
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

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}