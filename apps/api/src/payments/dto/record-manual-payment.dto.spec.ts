import { PaymentStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecordManualPaymentDto } from './record-manual-payment.dto';

const validManualPayment = {
  amount: 100,
  currency: 'USD',
  userId: '5f8d0d55-e0a3-4cf0-a620-2412acd4361c',
  registrationId: '7c8d0d55-e0a3-4cf0-a620-2412acd4361d',
};

describe('RecordManualPaymentDto', () => {
  it.each([
    PaymentStatus.PENDING,
    PaymentStatus.COMPLETED,
    PaymentStatus.FAILED,
    PaymentStatus.REFUNDED,
  ])('should accept legacy writable status %s', async (inputStatus) => {
    const inputDto = plainToInstance(RecordManualPaymentDto, {
      ...validManualPayment,
      status: inputStatus,
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
  });

  it('should reject PARTIALLY_REFUNDED', async () => {
    const inputDto = plainToInstance(RecordManualPaymentDto, {
      ...validManualPayment,
      status: PaymentStatus.PARTIALLY_REFUNDED,
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(1);
    expect(actualErrors[0].property).toBe('status');
    expect(actualErrors[0].constraints).toHaveProperty('isIn');
  });

  it('should reject an unknown status', async () => {
    const inputDto = plainToInstance(RecordManualPaymentDto, {
      ...validManualPayment,
      status: 'UNKNOWN',
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(1);
    expect(actualErrors[0].property).toBe('status');
    expect(actualErrors[0].constraints).toHaveProperty('isIn');
  });

  it('should default an omitted status to COMPLETED', async () => {
    const inputDto = plainToInstance(
      RecordManualPaymentDto,
      validManualPayment,
    );

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
    expect(inputDto.status).toBe(PaymentStatus.COMPLETED);
  });
});
