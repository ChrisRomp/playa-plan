import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

/**
 * Dedicated module for Prometheus metrics server
 * Runs on port 9464 for internal Docker networking only
 */
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true, // Enable default Node.js metrics
      },
      defaultLabels: {
        app: 'playa-plan-api',
        environment: process.env.NODE_ENV || 'development',
      },
    }),
  ],
})
export class MetricsModule {} 