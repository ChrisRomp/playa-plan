import { PaymentStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePaymentDto } from './update-payment.dto';

describe('UpdatePaymentDto', () => {
  it.each([
    PaymentStatus.PENDING,
    PaymentStatus.COMPLETED,
    PaymentStatus.FAILED,
    PaymentStatus.REFUNDED,
  ])('should accept legacy writable status %s', async (inputStatus) => {
    const inputDto = plainToInstance(UpdatePaymentDto, {
      status: inputStatus,
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
  });

  it('should reject PARTIALLY_REFUNDED', async () => {
    const inputDto = plainToInstance(UpdatePaymentDto, {
      status: PaymentStatus.PARTIALLY_REFUNDED,
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(1);
    expect(actualErrors[0].property).toBe('status');
    expect(actualErrors[0].constraints).toHaveProperty('isIn');
  });

  it('should reject an unknown status', async () => {
    const inputDto = plainToInstance(UpdatePaymentDto, {
      status: 'UNKNOWN',
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(1);
    expect(actualErrors[0].property).toBe('status');
    expect(actualErrors[0].constraints).toHaveProperty('isIn');
  });

  it('should accept an omitted status', async () => {
    const inputDto = plainToInstance(UpdatePaymentDto, {
      providerRefId: 'provider-reference',
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
  });
});
