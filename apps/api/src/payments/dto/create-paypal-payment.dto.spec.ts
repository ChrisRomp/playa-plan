import { validate } from 'class-validator';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';
import { CreatePaypalPaymentDto } from './create-paypal-payment.dto';

describe('CreatePaypalPaymentDto', () => {
  const buildValidDto = (): CreatePaypalPaymentDto => {
    const dto = new CreatePaypalPaymentDto();
    dto.amount = 100;
    dto.userId = '5f8d0d55-e0a3-4cf0-a620-2412acd4361c';
    dto.itemDescription = 'Camp registration fee';
    dto.successUrl = 'https://example.com/success';
    dto.cancelUrl = 'https://example.com/cancel';
    return dto;
  };

  it('should reject an amount above the refund cents representation', async () => {
    const inputDto = buildValidDto();
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

  describe('amount cents precision', () => {
    it('should reject an amount with more than two decimal places (0.015)', async () => {
      const inputDto = buildValidDto();
      inputDto.amount = 0.015;

      const actualErrors = await validate(inputDto);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'amount',
            constraints: expect.objectContaining({ isCentsPrecision: expect.any(String) }),
          }),
        ]),
      );
    });

    it.each([0.01, 0.1, 1, 50, 100.5, 99.99])(
      'should accept a representable amount %s',
      async (value) => {
        const inputDto = buildValidDto();
        inputDto.amount = value;

        const actualErrors = await validate(inputDto);

        expect(actualErrors.filter((e) => e.property === 'amount')).toHaveLength(0);
      },
    );
  });
});
