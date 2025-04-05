import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Security Headers Middleware
 * Adds additional security headers to all responses to protect against various attacks
 * Complements Helmet middleware with application-specific security settings
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityHeadersMiddleware.name);
  private readonly isDevelopment: boolean;
  
  /**
   * Constructor for the SecurityHeadersMiddleware
   * @param configService - The NestJS ConfigService for accessing environment configuration
   */
  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';
    
    if (this.isDevelopment) {
      this.logger.log('Running in development mode - some security headers will be relaxed');
    }
  }
  
  /**
   * Middleware function to add security headers to responses
   * @param req - The HTTP request object
   * @param res - The HTTP response object
   * @param next - The next middleware function
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // Content Security Policy (CSP)
    // Note: In production, this should be more restrictive
    const cspDirectives = this.isDevelopment 
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;"
      : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self';";
    
    res.setHeader('Content-Security-Policy', cspDirectives);
    
    // Strict Transport Security (HSTS)
    // Only in production as it causes issues with local development
    if (!this.isDevelopment) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }
    
    // Permissions Policy (formerly Feature-Policy)
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Cache control - prevents caching of sensitive data in browsers
    // For API responses that shouldn't be cached by browsers
    if (this.isSecureEndpoint(req.path)) {
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // Cross-Origin-Embedder-Policy (COEP)
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    
    // Cross-Origin-Opener-Policy (COOP)
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    
    // Cross-Origin-Resource-Policy (CORP)
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    
    // Pass control to the next middleware function
    next();
  }
  
  /**
   * Determines if the current endpoint should have strict security headers
   * @param path - The request path
   * @returns True if the path should have stricter security headers
   */
  private isSecureEndpoint(path: string): boolean {
    // Paths that contain sensitive data should have strict caching restrictions
    return path.includes('/auth/') || 
      path.includes('/users/') || 
      path.includes('/payments/') || 
      path.startsWith('/api/');
  }
}