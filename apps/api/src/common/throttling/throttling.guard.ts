import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

/**
 * Custom throttling guard layered on top of the v6 ThrottlerGuard.
 *
 * The parent guard iterates every named throttler on every request, so when
 * multiple throttlers are configured (for example `default` + `auth`), each
 * throttler's `skipIf` decides whether it applies to the current request.
 * That selection lives in `ThrottlingModule` so the throttlers themselves
 * encode "I apply to auth paths only" or "I apply to non-auth paths only".
 *
 * This subclass adds two cross-cutting overrides on top of the v6 hooks:
 *   - `shouldSkip()`  — global skip for health-check paths and (optionally)
 *                       GET requests.
 *   - `getTracker()`  — track authenticated users by user ID instead of IP,
 *                       so a shared NAT does not collapse many users into
 *                       one throttle bucket. Falls back to IP for anonymous
 *                       traffic.
 */
@Injectable()
export class ThrottlingGuard extends ThrottlerGuard {
  /**
   * Optional configuration to skip throttling for GET requests. Defaults
   * to false so safe-by-default behavior is to throttle every request type.
   */
  private readonly ignoreGetRequests: boolean = false;

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    ignoreGetRequests?: boolean,
  ) {
    super(options, storageService, reflector);

    if (ignoreGetRequests !== undefined) {
      this.ignoreGetRequests = ignoreGetRequests;
    }
  }

  /**
   * Global skip hook (v6 `shouldSkip`). Returning true bypasses every
   * throttler for this request.
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    if (this.ignoreGetRequests && request.method === 'GET') {
      return true;
    }
    if (this.isHealthCheckRequest(request)) {
      return true;
    }
    return false;
  }

  /**
   * Custom request tracker (v6 `getTracker`). Authenticated requests are
   * tracked by user ID so a single user behind a NAT cannot DOS the bucket
   * for everyone else sharing the IP.
   */
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    if (user && typeof user.id === 'string') {
      return `user_${user.id}`;
    }
    const ip = typeof req.ip === 'string' ? req.ip : undefined;
    return ip ?? 'unknown';
  }

  private isHealthCheckRequest(request: Request): boolean {
    return request.path.includes('/health') ||
           request.path.includes('/ping');
  }

  /**
   * Returns true when the path should be subject to the strict `auth`
   * throttler. Exposed as a static helper so `ThrottlingModule` can wire
   * it into per-throttler `skipIf` callbacks.
   */
  static isAuthenticationRequest(request: Request): boolean {
    if (request.method !== 'POST') return false;
    const p = request.path;
    return (
      p.includes('/auth/login') ||
      p.includes('/auth/register') ||
      p.includes('/auth/request-login-code') ||
      p.includes('/auth/login-with-code') ||
      p.includes('/auth/passkey/options') ||
      p.includes('/auth/passkey/verify')
    );
  }
}