import { Module, NestModule, MiddlewareConsumer, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ShiftsModule } from './shifts/shifts.module';
import { PaymentsModule } from './payments/payments.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CampingOptionsModule } from './camping-options/camping-options.module';
import { JobsModule } from './jobs/jobs.module';
import { CoreConfigModule } from './core-config/core-config.module';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ThrottlingModule } from './common/throttling/throttling.module';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { Public } from './auth/decorators/public.decorator';
import configuration from './config/configuration';
import validationSchema from './config/validation.schema';

@Controller()
class AppController {
  @Get('health')
  @Public()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

/**
 * Root module of the PlayaPlan API application
 * Imports all feature modules and global modules
 */
@Module({
  imports: [
    // Global configuration module with environment-specific settings
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `../../.env.${process.env.NODE_ENV}`,
        '../../.env',
        `.env.${process.env.NODE_ENV}`,
        '.env'
      ],
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
      limit: 300, // 300 requests per minute by default (5 per second)
      ignoreGetRequests: true, // Don't throttle GET requests
    }),
    // Feature modules
    UsersModule,
    AuthModule,
    // CampsModule, // Removed since Camp entity has been removed
    ShiftsModule,
    PaymentsModule,
    RegistrationsModule,
    NotificationsModule,
    CampingOptionsModule,
    JobsModule,
    CoreConfigModule,
    // Other feature modules will be added here as they are implemented
  ],
  controllers: [AppController],
  providers: [
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Security headers middleware provider
    SecurityHeadersMiddleware,
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure global middleware
   * @param consumer - The middleware consumer
   */
  configure(consumer: MiddlewareConsumer) {
    // Apply security headers middleware to all routes
    consumer.apply(SecurityHeadersMiddleware).forRoutes('*');
  }
}