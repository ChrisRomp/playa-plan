import { PaymentStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { UpdatePaymentDto } from './update-payment.dto';

describe('UpdatePaymentDto', () => {
  it.each([PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED])(
    'should reject refund-derived status %s',
    async (refundDerivedStatus) => {
      const inputDto = new UpdatePaymentDto();
      Object.assign(inputDto, { status: refundDerivedStatus });

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
    },
  );

  it.each([PaymentStatus.PENDING, PaymentStatus.COMPLETED, PaymentStatus.FAILED])(
    'should accept directly updatable status %s',
    async (updatableStatus) => {
      const inputDto = new UpdatePaymentDto();
      inputDto.status = updatableStatus;

      const actualErrors = await validate(inputDto);

      expect(actualErrors).toHaveLength(0);
    },
  );

  it('should accept an update with no status change', async () => {
    const inputDto = new UpdatePaymentDto();
    inputDto.providerRefId = 'pi_3MwDX2CZ6qsJgOG31M02Umy2';

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
  });
});
