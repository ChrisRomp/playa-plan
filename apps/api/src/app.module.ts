import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ThrottlingModule } from './common/throttling/throttling.module';
import configuration from './config/configuration';
import validationSchema from './config/validation.schema';

/**
 * Root module of the PlayaPlan API application
 * Imports all feature modules and global modules
 */
@Module({
  imports: [
    // Global configuration module with environment-specific settings
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      load: [configuration],
      validationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    // Prisma module for database access
    PrismaModule,
    // Security modules
    ThrottlingModule.register({
      ttl: 60, // 60 second window
      limit: 100, // 100 requests per minute by default
      ignoreGetRequests: true, // Don't throttle GET requests
    }),
    // Feature modules
    UsersModule,
    AuthModule,
    // Other feature modules will be added here as they are implemented
  ],
  providers: [
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}