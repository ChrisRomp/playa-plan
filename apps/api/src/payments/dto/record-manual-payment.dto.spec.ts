import { PaymentStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { RecordManualPaymentDto } from './record-manual-payment.dto';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';

describe('RecordManualPaymentDto', () => {
  it('should reject an amount above the refund cents representation', async () => {
    const inputDto = new RecordManualPaymentDto();
    inputDto.amount = PAYMENT_AMOUNT_LIMITS.majorUnits + 0.01;
    inputDto.userId = '5f8d0d55-e0a3-4cf0-a620-2412acd4361c';

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

  it('should reject statuses that imply an existing refund', async () => {
    const inputDto = new RecordManualPaymentDto();
    inputDto.amount = 100;
    inputDto.userId = '5f8d0d55-e0a3-4cf0-a620-2412acd4361c';
    Object.assign(inputDto, { status: PaymentStatus.PARTIALLY_REFUNDED });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'status',
          constraints: expect.objectContaining({
            isIn: expect.any(String),
          }),
        }),
      ]),
    );
  });
});
