import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';

/**
 * Root module of the PlayaPlan API application
 * Imports all feature modules and global modules
 */
@Module({
  imports: [
    // Global configuration module to load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    // Prisma module for database access
    PrismaModule,
    // Feature modules will be added here as they are implemented
  ],
})
export class AppModule {}