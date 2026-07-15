import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RefundExecutionMode, RegistrationStatus } from '@prisma/client';
import { CreateRefundDto } from './create-refund.dto';

const validRequest = {
  amountCents: 5000,
  executionMode: RefundExecutionMode.MANUAL,
  idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
};

async function validateRequest(
  request: Record<string, unknown>
): Promise<ReturnType<typeof validate>> {
  const inputDto = plainToInstance(CreateRefundDto, request);
  return validate(inputDto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('CreateRefundDto', () => {
  it.each([
    validRequest,
    {
      amountCents: 5000,
      executionMode: RefundExecutionMode.STRIPE,
      idempotencyKey: validRequest.idempotencyKey,
    },
    {
      fullRefund: true,
      executionMode: RefundExecutionMode.MANUAL,
      idempotencyKey: validRequest.idempotencyKey,
    },
  ])('should accept one valid refund amount selection', async inputRequest => {
    const actualErrors = await validateRequest(inputRequest);

    expect(actualErrors).toHaveLength(0);
  });

  it.each([
    {},
    { amountCents: 100, fullRefund: true },
    { fullRefund: false },
    { amountCents: 0 },
    { amountCents: -1 },
    { amountCents: 1.5 },
    { amountCents: Number.MAX_SAFE_INTEGER + 1 },
  ])('should reject invalid amount selection %o', async inputSelection => {
    const actualErrors = await validateRequest({
      ...validRequest,
      amountCents: undefined,
      ...inputSelection,
    });

    expect(actualErrors.some(error => error.property === 'amountCents')).toBe(true);
  });

  it('should normalize optional text and accept allowed registration status', async () => {
    const inputDto = plainToInstance(CreateRefundDto, {
      ...validRequest,
      reason: ' duplicate charge ',
      externalReference: ' refund-123 ',
      resultingRegistrationStatus: RegistrationStatus.WAITLISTED,
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
    expect(inputDto.reason).toBe('duplicate charge');
    expect(inputDto.externalReference).toBe('refund-123');
  });

  it.each([
    RegistrationStatus.CANCELLED,
    RegistrationStatus.APPLICATION_SUBMITTED,
    RegistrationStatus.APPLICATION_APPROVED,
    RegistrationStatus.APPLICATION_DECLINED,
  ])(
    'should reject resulting registration status %s with cancellation guidance',
    async inputStatus => {
      const actualErrors = await validateRequest({
        ...validRequest,
        resultingRegistrationStatus: inputStatus,
      });

      const statusError = actualErrors.find(
        error => error.property === 'resultingRegistrationStatus'
      );
      expect(statusError).toBeDefined();
      expect(Object.values(statusError?.constraints ?? {}).join(' ')).toContain(
        'cancellation workflow'
      );
    }
  );

  it('should reject a manual-only external reference for Stripe mode', async () => {
    const actualErrors = await validateRequest({
      ...validRequest,
      executionMode: RefundExecutionMode.STRIPE,
      externalReference: 'external-refund-123',
    });

    expect(actualErrors.find(error => error.property === 'externalReference')).toBeDefined();
  });

  it('should reject invalid mode, invalid UUID, oversized text, and derived fields', async () => {
    const actualErrors = await validateRequest({
      ...validRequest,
      executionMode: 'PAYPAL',
      idempotencyKey: 'not-a-uuid',
      reason: 'x'.repeat(501),
      externalReference: 'x'.repeat(256),
      currency: 'USD',
      availableRefundCents: 5000,
      userId: 'admin-id',
    });

    expect(actualErrors.map(error => error.property)).toEqual(
      expect.arrayContaining([
        'executionMode',
        'idempotencyKey',
        'reason',
        'externalReference',
        'currency',
        'availableRefundCents',
        'userId',
      ])
    );
  });
});
