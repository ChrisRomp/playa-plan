import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';

/**
 * Creates and starts the internal metrics server
 * This runs on port 9464 and is only accessible via Docker internal networking
 */
export async function createMetricsServer(): Promise<void> {
  const logger = new Logger('MetricsServer');
  
  try {
    const app = await NestFactory.create(MetricsModule, {
      logger: false, // Disable logging for metrics server to reduce noise
    });

    // Listen on all interfaces within the container
    await app.listen(9464, '0.0.0.0');
    logger.log('🔧 Metrics server running on port 9464 (internal)');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
      logger.warn('⚠️ Metrics server port 9464 already in use, skipping metrics server');
      return;
    }
    logger.error('❌ Failed to start metrics server', error);
    throw error;
  }
} 