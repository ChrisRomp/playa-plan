import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { APP_GUARD } from '@nestjs/core';
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
    // Feature modules
    UsersModule,
    // Other feature modules will be added here as they are implemented
  ],
  providers: [
    // Global providers will be added here
  ],
})
export class AppModule {}