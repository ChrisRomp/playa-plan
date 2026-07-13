import { PaymentStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { RecordManualPaymentDto } from './record-manual-payment.dto';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';

describe('RecordManualPaymentDto', () => {
  const buildValidDto = (): RecordManualPaymentDto => {
    const dto = new RecordManualPaymentDto();
    dto.amount = 100;
    dto.userId = '5f8d0d55-e0a3-4cf0-a620-2412acd4361c';
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

  it('should reject statuses that imply an existing refund', async () => {
    const inputDto = buildValidDto();
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
