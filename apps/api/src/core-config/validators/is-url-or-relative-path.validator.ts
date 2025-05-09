import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Validates that a string is either a valid URL or a relative path starting with '/'
 * 
 * @param validationOptions The validation options
 * @returns A PropertyDecorator that validates URLs or relative paths
 */
export function IsUrlOrRelativePath(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUrlOrRelativePath',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: string | unknown) {
          if (value === undefined || value === null || value === '') {
            return true; // Allow empty values (if optional)
          }

          if (typeof value !== 'string') {
            return false;
          }

          // Check for spaces at the beginning
          if (value !== value.trim()) {
            return false;
          }

          // Check if it's a valid relative path starting with slash
          if (value.startsWith('/')) {
            // Ensure there are no spaces in the path
            if (value.includes(' ')) {
              return false;
            }
            // Make sure it's a valid path format with at least one character after the slash
            if (value.length > 1 && /^\/[a-zA-Z0-9]/.test(value)) {
              return true;
            }
            return false;
          }

          // Check common protocol presence
          const hasValidProtocol = /^(https?|ftp):\/\//.test(value);
          if (!hasValidProtocol) {
            return false;
          }

          // Check if it's a valid URL using URL constructor
          try {
            const url = new URL(value);
            // Ensure it has a protocol and hostname
            if (!url.protocol || !url.hostname) {
              return false;
            }
            // Check for common URL issues
            if (url.hostname === '' || url.protocol === ':') {
              return false;
            }
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be either a valid URL or a relative path starting with '/'`;
        }
      }
    });
  };
} 