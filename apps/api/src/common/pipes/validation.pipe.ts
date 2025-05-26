import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';
import { isObject } from 'class-validator';

/**
 * Custom validation pipe that handles both validation and sanitization.
 * Validates request payloads using class-validator and sanitizes string inputs
 * to prevent XSS attacks and other injection vulnerabilities.
 */
@Injectable()
export class GlobalValidationPipe implements PipeTransform {
  private readonly logger = new Logger(GlobalValidationPipe.name);
  
  // Fields that are allowed to contain HTML content
  private readonly htmlAllowedFields: string[] = [
    'homePageBlurb', 
    'campDescription', 
    'registrationTerms'
  ];
  
  // Strict sanitization options for regular text fields (removes all HTML)
  private readonly sanitizeHtmlOptions: sanitizeHtml.IOptions = {
    allowedTags: [],
    allowedAttributes: {},
    allowedIframeHostnames: [],
  };
  
  // More permissive sanitization options for fields that should allow HTML
  private readonly htmlFieldSanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
      'ul', 'ol', 'li', 'b', 'i', 'strong', 'em', 'a', 'span',
      'blockquote', 'code', 'pre', 'div'
    ],
    allowedAttributes: {
      'a': ['href', 'target', 'rel', 'title', 'aria-label'],
      'span': ['style', 'class'],
      'div': ['style', 'class'],
      'p': ['style', 'class'],
      'li': ['style', 'class'],
      'ul': ['style', 'class'],
      'ol': ['style', 'class'],
      'h1': ['style', 'class'],
      'h2': ['style', 'class'],
      'h3': ['style', 'class'],
      'h4': ['style', 'class'],
      'h5': ['style', 'class'],
      'h6': ['style', 'class'],
      'blockquote': ['style', 'class']
    },
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
  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const { metatype } = metadata;
    
    // Skip validation if no metatype or if metatype is a primitive type
    if (!metatype || !this.shouldValidate(metatype)) {
      return this.sanitizeData(value, metadata.data);
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
    return this.sanitizeData(object, metadata.data);
  }

  /**
   * Converts validation errors into a readable array of error messages
   * 
   * @param errors - Array of validation errors
   * @returns Array of error messages
   */
  private buildErrorMessages(errors: ValidationError[]): string[] {
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
   * @param fieldName - Optional field name to check if HTML is allowed
   * @returns Sanitized data
   */
  private sanitizeData(data: unknown, fieldName?: string): unknown {
    if (typeof data === 'string') {
      // Choose sanitization options based on whether this field allows HTML
      const options = this.htmlAllowedFields.includes(fieldName || '') 
        ? this.htmlFieldSanitizeOptions 
        : this.sanitizeHtmlOptions;
        
      // Sanitize simple string values
      return sanitizeHtml(data, options);
    }
    
    if (Array.isArray(data)) {
      // Recursively sanitize arrays
      return data.map(item => this.sanitizeData(item, fieldName));
    }
    
    if (isObject(data) && data !== null) {
      // Recursively sanitize objects
      const sanitized: Record<string, unknown> = { ...data };
      
      for (const key of Object.keys(sanitized)) {
        // Pass the current field name down to child properties
        sanitized[key] = this.sanitizeData(sanitized[key], key);
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
  private shouldValidate(metatype: abstract new (...args: unknown[]) => unknown): boolean {
    const types: Array<abstract new (...args: unknown[]) => unknown> = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}