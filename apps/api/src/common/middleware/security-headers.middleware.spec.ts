import { Test, TestingModule } from '@nestjs/testing';
import { SecurityHeadersMiddleware } from './security-headers.middleware';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

describe('SecurityHeadersMiddleware', () => {
  let middleware: SecurityHeadersMiddleware;
  let mockConfigService: Partial<ConfigService>;
  let mockNext: jest.Mock;

  // Helper function to create mock request with specified path
  const createMockRequest = (path: string): Partial<Request> => ({
    path,
  });

  // Helper function to create mock response
  const createMockResponse = (): Partial<Response> => ({
    setHeader: jest.fn(),
  });

  beforeEach(async () => {
    // Mock ConfigService with default development environment
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'NODE_ENV') {
          return 'development';
        }
        return undefined;
      }),
    };

    // Create test module with mocked ConfigService
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityHeadersMiddleware,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    middleware = module.get<SecurityHeadersMiddleware>(SecurityHeadersMiddleware);
    mockNext = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should set appropriate security headers in development mode', () => {
    // Arrange - development mode is set in beforeEach
    const mockRequest = createMockRequest('/api/users');
    const mockResponse = createMockResponse();
    
    // Act
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Assert
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("'unsafe-inline'")
    );
    expect(mockResponse.setHeader).not.toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.any(String)
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      expect.any(String)
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Referrer-Policy',
      'strict-origin-when-cross-origin'
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should set stricter security headers in production mode', async () => {
    // Arrange
    mockConfigService.get = jest.fn().mockImplementation((key: string) => {
      if (key === 'NODE_ENV') {
        return 'production';
      }
      return undefined;
    });
    
    // Recreate middleware with production config
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityHeadersMiddleware,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    
    const productionMiddleware = module.get<SecurityHeadersMiddleware>(SecurityHeadersMiddleware);
    const mockRequest = createMockRequest('/api/users');
    const mockResponse = createMockResponse();
    
    // Act
    productionMiddleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Assert
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.not.stringContaining("'unsafe-inline'")
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should set cache control headers for secure endpoints', () => {
    // Arrange
    const mockRequest = createMockRequest('/auth/login');
    const mockResponse = createMockResponse();
    
    // Act
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Assert
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store, max-age=0, must-revalidate'
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Expires', '0');
  });

  it('should not set cache control headers for non-secure endpoints', () => {
    // Arrange
    const mockRequest = createMockRequest('/public/docs');
    const mockResponse = createMockResponse();
    
    // Act
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Assert
    expect(mockResponse.setHeader).not.toHaveBeenCalledWith(
      'Cache-Control',
      expect.any(String)
    );
    expect(mockResponse.setHeader).not.toHaveBeenCalledWith(
      'Pragma',
      expect.any(String)
    );
  });

  it('should set Cross-Origin policy headers', () => {
    // Arrange
    const mockRequest = createMockRequest('/api/users');
    const mockResponse = createMockResponse();
    
    // Act
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Assert
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Embedder-Policy',
      'require-corp'
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Opener-Policy',
      'same-origin'
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Resource-Policy',
      'same-origin'
    );
  });
});