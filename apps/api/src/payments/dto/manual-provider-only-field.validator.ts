import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

/**
 * Rejects the decorated field with a validation error when it is present and
 * the sibling `provider` field is not `MANUAL`. Apply to fields that carry
 * manual-payment-only provenance metadata (e.g. externalPaymentMethod,
 * externalPaymentReference) so that a Stripe or PayPal row can never be
 * persisted with contradictory external-payment metadata.
 */
export function IsManualProviderOnlyField(
  validationOptions?: ValidationOptions,
): (object: object, propertyName: string) => void {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isManualProviderOnlyField',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (value === undefined || value === null) {
            return true;
          }
          const dto = args.object as { provider?: string };
          return dto.provider === PaymentProvider.MANUAL;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} is only allowed when provider is MANUAL`;
        },
      },
    });
  };
}
