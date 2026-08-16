import { registerDecorator, ValidationOptions } from 'class-validator';

/** Validates that a string contains no more than the configured number of lines. */
export function MaxLineCount(
  maximumLines: number,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    registerDecorator({
      name: 'maxLineCount',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      constraints: [maximumLines],
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value !== 'string' || value.split(/\r\n|\r|\n/).length <= maximumLines;
        },
      },
    });
  };
}
