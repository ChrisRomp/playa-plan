import { PaymentStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { RecordManualPaymentDto } from './record-manual-payment.dto';

describe('RecordManualPaymentDto', () => {
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
