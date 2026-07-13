import { validate } from 'class-validator';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';
import { CreateStripePaymentDto } from './create-stripe-payment.dto';

describe('CreateStripePaymentDto', () => {
  it('should reject a cents amount above the refund cents representation', async () => {
    const inputDto = new CreateStripePaymentDto();
    inputDto.amount = PAYMENT_AMOUNT_LIMITS.cents + 1;

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
