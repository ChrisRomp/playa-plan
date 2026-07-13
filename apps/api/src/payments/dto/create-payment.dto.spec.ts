import { PaymentProvider } from '@prisma/client';
import { validate } from 'class-validator';
import { CreatePaymentDto } from './create-payment.dto';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';

const VALID_USER_ID = '5f8d0d55-e0a3-4cf0-a620-2412acd4361c';

function buildBaseDto(provider: PaymentProvider): CreatePaymentDto {
  const dto = new CreatePaymentDto();
  dto.amount = 100;
  dto.provider = provider;
  dto.userId = VALID_USER_ID;
  return dto;
}

describe('CreatePaymentDto', () => {
  describe('amount', () => {
    it('should accept the maximum representable payment amount', async () => {
      const inputDto = buildBaseDto(PaymentProvider.MANUAL);
      inputDto.amount = PAYMENT_AMOUNT_LIMITS.majorUnits;

      const actualErrors = await validate(inputDto);

      expect(actualErrors.filter((error) => error.property === 'amount')).toHaveLength(0);
    });

    it('should reject an amount above the refund cents representation', async () => {
      const inputDto = buildBaseDto(PaymentProvider.MANUAL);
      inputDto.amount = PAYMENT_AMOUNT_LIMITS.majorUnits + 0.01;

      const actualErrors = await validate(inputDto);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'amount',
            constraints: expect.objectContaining({ max: expect.any(String) }),
          }),
        ]),
      );
    });
  });

  describe('externalPaymentMethod', () => {
    it('should accept externalPaymentMethod when provider is MANUAL', async () => {
      const inputDto = buildBaseDto(PaymentProvider.MANUAL);
      inputDto.externalPaymentMethod = 'Cash';

      const actualErrors = await validate(inputDto);

      expect(actualErrors.filter((e) => e.property === 'externalPaymentMethod')).toHaveLength(0);
    });

    it.each([PaymentProvider.STRIPE, PaymentProvider.PAYPAL])(
      'should reject externalPaymentMethod when provider is %s',
      async (provider) => {
        const inputDto = buildBaseDto(provider);
        inputDto.externalPaymentMethod = 'Cash';

        const actualErrors = await validate(inputDto);

        expect(actualErrors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              property: 'externalPaymentMethod',
              constraints: expect.objectContaining({
                isManualProviderOnlyField: expect.any(String),
              }),
            }),
          ]),
        );
      },
    );

    it('should accept absent externalPaymentMethod for any provider', async () => {
      for (const provider of [PaymentProvider.STRIPE, PaymentProvider.PAYPAL, PaymentProvider.MANUAL]) {
        const inputDto = buildBaseDto(provider);

        const actualErrors = await validate(inputDto);

        expect(actualErrors.filter((e) => e.property === 'externalPaymentMethod')).toHaveLength(0);
      }
    });
  });

  describe('externalPaymentReference', () => {
    it('should accept externalPaymentReference when provider is MANUAL', async () => {
      const inputDto = buildBaseDto(PaymentProvider.MANUAL);
      inputDto.externalPaymentReference = 'Check #1234';

      const actualErrors = await validate(inputDto);

      expect(actualErrors.filter((e) => e.property === 'externalPaymentReference')).toHaveLength(0);
    });

    it.each([PaymentProvider.STRIPE, PaymentProvider.PAYPAL])(
      'should reject externalPaymentReference when provider is %s',
      async (provider) => {
        const inputDto = buildBaseDto(provider);
        inputDto.externalPaymentReference = 'Check #1234';

        const actualErrors = await validate(inputDto);

        expect(actualErrors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              property: 'externalPaymentReference',
              constraints: expect.objectContaining({
                isManualProviderOnlyField: expect.any(String),
              }),
            }),
          ]),
        );
      },
    );

    it('should accept absent externalPaymentReference for any provider', async () => {
      for (const provider of [PaymentProvider.STRIPE, PaymentProvider.PAYPAL, PaymentProvider.MANUAL]) {
        const inputDto = buildBaseDto(provider);

        const actualErrors = await validate(inputDto);

        expect(actualErrors.filter((e) => e.property === 'externalPaymentReference')).toHaveLength(0);
      }
    });
  });
});
