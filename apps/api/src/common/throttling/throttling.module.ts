import { Module, DynamicModule, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerModule,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  getOptionsToken,
} from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ThrottlingGuard } from './throttling.guard';
import { APP_GUARD } from '@nestjs/core';
import { Reflector } from '@nestjs/core';

interface ThrottleLimits {
  defaultLimit: number;
  authLimit: number;
}

export function resolveThrottleLimits(
  getNumber: (key: string) => number | undefined,
  sharedLimit: number
): ThrottleLimits {
  const defaultLimit = getNumber('THROTTLE_DEFAULT_LIMIT') ?? Math.min(sharedLimit, 300);
  const authLimit = getNumber('THROTTLE_AUTH_LIMIT') ?? Math.min(sharedLimit, 30);

  return { defaultLimit, authLimit };
}

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
 * `skipIf` for the strict `auth` throttler — apply only to authentication
 * endpoints.
 */
const skipIfNotAuth = (ctx: ExecutionContext): boolean => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return !ThrottlingGuard.isAuthenticationRequest(req);
};

/**
 * `skipIf` for the relaxed `default` throttler — skip on auth endpoints
 * since the stricter `auth` throttler covers those.
 */
const skipIfAuth = (ctx: ExecutionContext): boolean => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return ThrottlingGuard.isAuthenticationRequest(req);
};

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

            const throttleLimits = resolveThrottleLimits(
              (key: string) => configService.get<number>(key),
              limit
            );

            // Convert to milliseconds for the newer Throttler API version
            const ttlMs = ttl * 1000;

            return {
              throttlers: [
                {
                  name: 'default',
                  ttl: ttlMs,
                  limit: throttleLimits.defaultLimit,
                  skipIf: skipIfAuth,
                },
                {
                  name: 'auth',
                  ttl: ttlMs,
                  limit: throttleLimits.authLimit,
                  skipIf: skipIfNotAuth,
                },
              ],
            };
          },
        }),
      ],
      providers: [
        {
          provide: APP_GUARD,
          inject: [getOptionsToken(), Reflector, ThrottlerStorage],
          useFactory: (
            throttlerOptions: ThrottlerModuleOptions,
            reflector: Reflector,
            storageService: ThrottlerStorage
          ) => {
            // IMPORTANT: pass the SAME options object that ThrottlerModule.forRootAsync
            // produced. @nestjs/throttler v6 reads ttl/limit/skipIf from the constructor
            // arg (this.options); a separate options object would silently bypass the
            // env-driven THROTTLE_TTL / THROTTLE_LIMIT configuration.
            return new ThrottlingGuard(
              throttlerOptions,
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