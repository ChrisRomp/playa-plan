import { Module, DynamicModule, ExecutionContext } from '@nestjs/common';
import { 
  ThrottlerModule, 
  ThrottlerModuleOptions,
  ThrottlerStorage,
  ThrottlerOptions
} from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlingGuard } from './throttling.guard';
import { APP_GUARD } from '@nestjs/core';
import { Reflector } from '@nestjs/core';

/**
 * Configuration options for the ThrottlingModule
 */
export interface ThrottlingModuleOptions {
  /**
   * Default TTL (time to live) in seconds for throttle entries
   */
  ttl: number;
  
  /**
   * Default limit of requests within the TTL window
   */
  limit: number;
  
  /**
   * Whether to ignore CRUD GET operations (default: false)
   */
  ignoreGetRequests?: boolean;
}

/**
 * Module to configure and apply rate limiting across the application.
 * Provides fine-grained control over rate limiting using the @nestjs/throttler package.
 */
@Module({})
export class ThrottlingModule {
  /**
   * Register the ThrottlingModule with custom configuration.
   * This method allows dynamic configuration of rate limiting parameters.
   * 
   * @param options - The throttling options to apply
   * @returns A dynamic module configured with the specified throttling parameters
   */
  static register(options?: Partial<ThrottlingModuleOptions>): DynamicModule {
    const ignoreGetRequests = options?.ignoreGetRequests;
    
    return {
      module: ThrottlingModule,
      imports: [
        ThrottlerModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService): ThrottlerModuleOptions => {
            const ttl = options?.ttl || 
              configService.get<number>('THROTTLE_TTL') || 60; // Default: 60 seconds
            
            const limit = options?.limit || 
              configService.get<number>('THROTTLE_LIMIT') || 100; // Default: 100 requests
            
            // Convert to milliseconds for the newer Throttler API version
            const ttlMs = ttl * 1000;
            
            return {
              throttlers: [
                {
                  ttl: ttlMs,
                  limit
                }
              ]
            };
          },
        }),
      ],
      providers: [
        {
          provide: APP_GUARD,
          inject: [Reflector, ThrottlerStorage],
          useFactory: (
            reflector: Reflector,
            storageService: ThrottlerStorage
          ) => {
            const defaultOptions: ThrottlerModuleOptions = {
              throttlers: [
                {
                  ttl: 60000,
                  limit: 100
                }
              ]
            };
            return new ThrottlingGuard(
              defaultOptions,
              storageService,
              reflector,
              ignoreGetRequests
            );
          },
        },
      ],
      exports: [ThrottlerModule],
    };
  }
}