import { RegistrationStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { CreateRefundDto } from './create-refund.dto';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';

describe('CreateRefundDto', () => {
  const buildValidDto = (): CreateRefundDto => {
    const dto = new CreateRefundDto();
    dto.paymentId = '5f8d0d55-e0a3-4cf0-a620-2412acd4361c';
    dto.amount = 50;
    return dto;
  };

  it('should reject an amount above the cents representation', async () => {
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

  it('should accept the post-application registration statuses', async () => {
    for (const status of [
      RegistrationStatus.PENDING,
      RegistrationStatus.CONFIRMED,
      RegistrationStatus.WAITLISTED,
    ]) {
      const inputDto = buildValidDto();
      inputDto.resultingRegistrationStatus = status;

      const actualErrors = await validate(inputDto);

      expect(actualErrors).toHaveLength(0);
    }
  });

  it('should reject application-phase registration statuses', async () => {
    for (const status of [
      RegistrationStatus.APPLICATION_SUBMITTED,
      RegistrationStatus.APPLICATION_APPROVED,
      RegistrationStatus.APPLICATION_DECLINED,
    ]) {
      const inputDto = buildValidDto();
      inputDto.resultingRegistrationStatus = status;

      const actualErrors = await validate(inputDto);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'resultingRegistrationStatus',
            constraints: expect.objectContaining({
              isIn: expect.any(String),
            }),
          }),
        ]),
      );
    }
  });

  it('should reject CANCELLED via the public refund DTO', async () => {
    const inputDto = buildValidDto();
    inputDto.resultingRegistrationStatus = RegistrationStatus.CANCELLED;

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'resultingRegistrationStatus',
          constraints: expect.objectContaining({
            isIn: expect.any(String),
          }),
        }),
      ]),
    );
  });
});
