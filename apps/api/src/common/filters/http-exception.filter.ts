import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Interface for the standardized error response format
 */
export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  correlationId?: string;
}

/**
 * Global HTTP exception filter to standardize error responses across the application
 * This filter catches all exceptions thrown within the application and transforms them
 * into a consistent response format with useful debugging information.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * Catches and formats all exceptions thrown within the application
   * 
   * @param exception - The caught exception object
   * @param host - The arguments host providing access to the underlying platform-specific request/response objects
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = request.headers['x-correlation-id'] as string;
    
    // Get status code and error details
    const status = 
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    
    // Extract the error message
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        // Handle NestJS validation errors which have a messages array
        if ('message' in exceptionResponse) {
          message = (exceptionResponse as { message: string | string[] }).message;
        }
        if ('error' in exceptionResponse) {
          error = (exceptionResponse as { error: string }).error;
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
      
      // Set standard error description based on status code if not explicitly provided
      if (error === 'Internal Server Error') {
        switch (status) {
          case HttpStatus.BAD_REQUEST:
            error = 'Bad Request';
            break;
          case HttpStatus.UNAUTHORIZED:
            error = 'Unauthorized';
            break;
          case HttpStatus.FORBIDDEN:
            error = 'Forbidden';
            break;
          case HttpStatus.NOT_FOUND:
            error = 'Not Found';
            break;
          case HttpStatus.CONFLICT:
            error = 'Conflict';
            break;
          case HttpStatus.UNPROCESSABLE_ENTITY:
            error = 'Unprocessable Entity';
            break;
          case HttpStatus.TOO_MANY_REQUESTS:
            error = 'Too Many Requests';
            break;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }
    
    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
      correlationId,
    };
    
    // Log the error (with different level based on status code)
    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} ${status}: ${
          Array.isArray(message) ? message.join(', ') : message
        }`,
      );
    }
    
    response.status(status).json(errorResponse);
  }
}