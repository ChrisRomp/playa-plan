import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter, ErrorResponse } from './http-exception.filter';
import { Request, Response } from 'express';
import { ArgumentsHost } from '@nestjs/common';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGetRequest: jest.Mock;
  let mockGetResponse: jest.Mock;
  let mockSwitchToHttp: jest.Mock;
  let mockHost: ArgumentsHost;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  
  beforeEach(() => {
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockResponse = { status: mockStatus };
    
    mockRequest = {
      url: '/test/url',
      method: 'GET',
      headers: { 'x-correlation-id': 'test-correlation-id' }
    };
    
    mockGetRequest = jest.fn().mockReturnValue(mockRequest);
    mockGetResponse = jest.fn().mockReturnValue(mockResponse);
    mockSwitchToHttp = jest.fn().mockReturnValue({
      getRequest: mockGetRequest,
      getResponse: mockGetResponse
    });
    
    mockHost = {
      switchToHttp: mockSwitchToHttp,
    } as unknown as ArgumentsHost;
    
    filter = new GlobalExceptionFilter();
    
    // Mock Date.now to return a fixed timestamp for consistent testing
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-04-05T12:00:00.000Z');
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('should handle HttpExceptions with proper status code and message', () => {
    // Arrange
    const exception = new HttpException('Test error message', HttpStatus.BAD_REQUEST);
    
    // Act
    filter.catch(exception, mockHost);
    
    // Assert
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Test error message',
      error: 'Bad Request',
      path: '/test/url',
      timestamp: '2025-04-05T12:00:00.000Z',
      correlationId: 'test-correlation-id'
    }));
  });
  
  it('should handle non-HttpExceptions as Internal Server Error', () => {
    // Arrange
    const exception = new Error('Something went wrong');
    
    // Act
    filter.catch(exception, mockHost);
    
    // Assert
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong',
      error: 'Internal Server Error',
      path: '/test/url',
      timestamp: '2025-04-05T12:00:00.000Z',
      correlationId: 'test-correlation-id'
    }));
  });
  
  it('should handle HttpExceptions with object response', () => {
    // Arrange
    const exceptionResponse = {
      message: ['validation error 1', 'validation error 2'],
      error: 'Validation Failed'
    };
    const exception = new HttpException(exceptionResponse, HttpStatus.BAD_REQUEST);
    
    // Act
    filter.catch(exception, mockHost);
    
    // Assert
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: HttpStatus.BAD_REQUEST,
      message: ['validation error 1', 'validation error 2'],
      error: 'Validation Failed',
      path: '/test/url',
      timestamp: '2025-04-05T12:00:00.000Z',
      correlationId: 'test-correlation-id'
    }));
  });
  
  it('should handle missing correlation ID', () => {
    // Arrange
    mockRequest.headers = {};
    const exception = new HttpException('Test error', HttpStatus.NOT_FOUND);
    
    // Act
    filter.catch(exception, mockHost);
    
    // Assert
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Test error',
      error: 'Not Found',
      path: '/test/url',
      timestamp: '2025-04-05T12:00:00.000Z',
      correlationId: undefined
    }));
  });
});