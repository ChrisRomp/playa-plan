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

          // Check if it's a valid relative path starting with slash
          if (value.startsWith('/')) {
            return true;
          }

          // Check if it's a valid URL using URL constructor
          try {
            new URL(value);
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