import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { THROTTLER_OPTIONS } from '@nestjs/throttler/dist/throttler.constants';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

/**
 * Custom throttling guard that extends the ThrottlerGuard from @nestjs/throttler.
 * Provides additional customization for rate limiting behavior.
 */
@Injectable()
export class ThrottlingGuard extends ThrottlerGuard {
  /**
   * Optional configuration to ignore specific request types (e.g., GET requests)
   */
  private readonly ignoreGetRequests: boolean = false;

  /**
   * Constructor that allows setting configuration options
   * @param ignoreGetRequests - Whether to ignore GET requests
   */
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
   * Determines whether the current request should be throttled
   * 
   * @param context - The execution context
   * @returns boolean indicating whether the request should be throttled
   */
  protected async shouldThrottle(
    context: ExecutionContext,
  ): Promise<boolean> {
    // Get the request object from the context
    const request = context.switchToHttp().getRequest<Request>();

    // Skip throttling for GET requests if configured to do so
    if (this.ignoreGetRequests && request.method === 'GET') {
      return false;
    }

    // Skip throttling for certain paths like health checks
    if (this.isHealthCheckRequest(request)) {
      return false;
    }

    // For all other requests, use the default throttling behavior
    return true;
  }

  /**
   * Get a tracking key for the current request
   * 
   * @param context - The execution context
   * @returns A string key for tracking rate limit usage
   */
  protected getTrackingKey(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest<Request>();
    
    // If user is authenticated, use their user ID for tracking
    if (request.user && 'id' in request.user) {
      return `user_${request.user['id']}`;
    }
    
    // Otherwise use client IP address
    return request.ip ?? 'unknown';
  }

  /**
   * Get the appropriate throttler name based on the request
   * 
   * @param context - The execution context
   * @returns The name of the throttler to use
   */
  protected getThrottlerName(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest<Request>();
    
    if (this.isAuthenticationRequest(request)) {
      return 'auth';
    }
    
    return 'default';
  }

  /**
   * Check if the request is targeting a health check endpoint
   * 
   * @param request - The HTTP request
   * @returns Whether the request is for a health check endpoint
   */
  private isHealthCheckRequest(request: Request): boolean {
    return request.path.includes('/health') || 
           request.path.includes('/ping');
  }

  /**
   * Check if the request is targeting an authentication endpoint
   * 
   * @param request - The HTTP request
   * @returns Whether the request is for an authentication endpoint
   */
  private isAuthenticationRequest(request: Request): boolean {
    return (request.path.includes('/auth/login') || 
            request.path.includes('/auth/register')) && 
            request.method === 'POST';
  }
}