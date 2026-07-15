import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ExternalPaymentMethod } from '@prisma/client';
import { CreateExternalPaymentDto } from './create-external-payment.dto';

const validRequest = {
  registrationId: '6adf7e80-3035-4d12-a2d4-45c591bb2441',
  amount: 125.5,
  externalMethod: ExternalPaymentMethod.CHECK,
  externalReference: ' check-123 ',
  idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
};

async function validateRequest(
  request: Record<string, unknown>,
): Promise<ReturnType<typeof validate>> {
  const inputDto = plainToInstance(CreateExternalPaymentDto, request);
  return validate(inputDto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('CreateExternalPaymentDto', () => {
  it('should normalize currency and external reference', async () => {
    const inputDto = plainToInstance(CreateExternalPaymentDto, {
      ...validRequest,
      currency: ' usd ',
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
    expect(inputDto.currency).toBe('USD');
    expect(inputDto.externalReference).toBe('check-123');
  });

  it('should default currency to USD', async () => {
    const inputDto = plainToInstance(CreateExternalPaymentDto, validRequest);

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
    expect(inputDto.currency).toBe('USD');
  });

  it.each([0, -1, 1.001, Number.NaN, Number.POSITIVE_INFINITY])(
    'should reject invalid amount %s',
    async (inputAmount) => {
      const actualErrors = await validateRequest({
        ...validRequest,
        amount: inputAmount,
      });

      expect(actualErrors.some((error) => error.property === 'amount')).toBe(true);
    },
  );

  it('should leave safe-cent range enforcement to service canonicalization', async () => {
    const actualErrors = await validateRequest({
      ...validRequest,
      amount: Number.MAX_SAFE_INTEGER,
    });

    expect(actualErrors).toHaveLength(0);
  });

  it('should reject invalid currency, method, reference, and UUID values', async () => {
    const actualErrors = await validateRequest({
      ...validRequest,
      registrationId: 'not-a-uuid',
      currency: 'US',
      externalMethod: 'WIRE',
      externalReference: 'x'.repeat(256),
      idempotencyKey: 'not-a-uuid',
    });

    expect(actualErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'registrationId',
        'currency',
        'externalMethod',
        'externalReference',
        'idempotencyKey',
      ]),
    );
  });

  it('should reject a client-supplied userId', async () => {
    const actualErrors = await validateRequest({
      ...validRequest,
      userId: '2d918d04-7c3b-4504-ae92-ee38a04dc18e',
    });

    expect(actualErrors).toEqual([
      expect.objectContaining({ property: 'userId' }),
    ]);
  });
});
