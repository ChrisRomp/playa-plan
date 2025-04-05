import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

/**
 * Service for handling Prisma ORM connections with proper pooling
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  
  constructor(private readonly configService: ConfigService) {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
    });
  }

  /**
   * Connect to the database when the module initializes
   */
  async onModuleInit() {
    try {
      this.logger.log('Connecting to database...');
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Gracefully disconnect from the database when the module is destroyed
   */
  async onModuleDestroy() {
    try {
      this.logger.log('Disconnecting from database...');
      await this.$disconnect();
      this.logger.log('Successfully disconnected from database');
    } catch (error: unknown) {
      this.logger.error('Error during database disconnection', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Use this method for healthcheck endpoints
   * @returns Information about the database connection status
   */
  async healthCheck() {
    try {
      // Execute a simple query to check connection
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        message: 'Database connection is healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      return {
        status: 'error',
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}