import { validate } from 'class-validator';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';
import { CreatePaypalPaymentDto } from './create-paypal-payment.dto';

describe('CreatePaypalPaymentDto', () => {
  it('should reject an amount above the refund cents representation', async () => {
    const inputDto = new CreatePaypalPaymentDto();
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
