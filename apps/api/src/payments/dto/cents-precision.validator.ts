import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Rejects the decorated field if its value has more than two decimal places.
 *
 * All dollar-denominated payment/refund amounts are converted to integer cents
 * before being stored or forwarded to payment processors.  Any sub-cent
 * fraction is silently rounded by `toCents`, so the API boundary must
 * reject such values to keep the durable record consistent with the
 * amount the caller sees.
 */
export function IsCentsPrecision(
  validationOptions?: ValidationOptions,
): (object: object, propertyName: string) => void {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isCentsPrecision',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'number' || !Number.isFinite(value)) return false;
          const str = value.toString();
          // Values in scientific notation (e.g. 1e-7) cannot represent cents precisely.
          if (str.includes('e') || str.includes('E')) return false;
          const parts = str.split('.');
          return parts.length === 1 || parts[1].length <= 2;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must have at most 2 decimal places`;
        },
      },
    });
  };
}
