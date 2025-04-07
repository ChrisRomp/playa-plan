import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';
import { isObject } from 'class-validator';

/**
 * Custom validation pipe that handles both validation and sanitization.
 * Validates request payloads using class-validator and sanitizes string inputs
 * to prevent XSS attacks and other injection vulnerabilities.
 */
@Injectable()
export class GlobalValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(GlobalValidationPipe.name);
  private readonly sanitizeHtmlOptions: sanitizeHtml.IOptions = {
    allowedTags: [],
    allowedAttributes: {},
    allowedIframeHostnames: [],
  };

  /**
   * Transform and validate input data based on class validator decorators.
   * Also sanitizes all string properties to prevent XSS attacks.
   * 
   * @param value - The input value to transform and validate
   * @param metadata - Metadata about the input parameter
   * @returns The validated and sanitized value
   * @throws BadRequestException if validation fails
   */
  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    const { metatype } = metadata;
    
    // Skip validation if no metatype or if metatype is a primitive type
    if (!metatype || !this.shouldValidate(metatype)) {
      return this.sanitizeData(value);
    }

    // If the incoming value is not an object (null or undefined), throw an error
    if (!isObject(value)) {
      throw new BadRequestException('Validation failed: No data submitted');
    }

    // Convert plain JavaScript objects to typed objects
    const object = plainToInstance(metatype, value);
    
    // Validate the instance using class-validator
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      const errorMessages = this.buildErrorMessages(errors);
      this.logger.warn(`Validation failed: ${errorMessages.join(', ')}`);
      throw new BadRequestException({
        message: errorMessages,
        error: 'Validation Error',
      });
    }

    // If validation passes, sanitize all strings in the object to prevent XSS attacks
    return this.sanitizeData(object);
  }

  /**
   * Converts validation errors into a readable array of error messages
   * 
   * @param errors - Array of validation errors
   * @returns Array of error messages
   */
  private buildErrorMessages(errors: any[]): string[] {
    const result: string[] = [];
    
    errors.forEach(err => {
      if (err.constraints) {
        // Get error messages from the constraints object
        const messages = Object.values(err.constraints);
        result.push(...messages as string[]);
      }
      
      // Process nested validation errors
      if (err.children && err.children.length > 0) {
        const nestedMessages = this.buildErrorMessages(err.children);
        const property = err.property;
        const propertyMessages = nestedMessages.map(m => `${property}: ${m}`);
        result.push(...propertyMessages);
      }
    });
    
    return result;
  }

  /**
   * Sanitizes data to prevent XSS attacks and other injection vulnerabilities
   * 
   * @param data - The data to sanitize
   * @returns Sanitized data
   */
  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      // Sanitize simple string values
      return sanitizeHtml(data, this.sanitizeHtmlOptions);
    }
    
    if (Array.isArray(data)) {
      // Recursively sanitize arrays
      return data.map(item => this.sanitizeData(item));
    }
    
    if (isObject(data) && data !== null) {
      // Recursively sanitize objects
      const sanitized: Record<string, any> = { ...data };
      
      for (const key of Object.keys(sanitized)) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
      
      return sanitized;
    }
    
    // Return primitives and other types as is
    return data;
  }

  /**
   * Determines whether a given metatype should be validated
   * 
   * @param metatype - The type to check
   * @returns True if the type should be validated, false otherwise
   */
  private shouldValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}