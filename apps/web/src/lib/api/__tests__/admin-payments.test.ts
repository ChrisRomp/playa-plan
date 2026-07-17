import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { api } from '../../api';
import {
  ADMIN_PAYMENT_PAGE_SIZE,
  adminPaymentsApi,
  CreateManualRefundRequest,
  CreateExternalPaymentRequest,
} from '../admin-payments';

vi.mock('../../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockApiGet = vi.mocked(api.get);
const mockApiPost = vi.mocked(api.post);

describe('adminPaymentsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use the dedicated bounded admin payment route', async () => {
    const mockPage = { payments: [], total: 0 };
    mockApiGet.mockResolvedValue({ data: mockPage });

    const actualPage = await adminPaymentsApi.getPayments();

    expect(mockApiGet).toHaveBeenCalledWith(
      `/payments/admin?skip=0&take=${ADMIN_PAYMENT_PAGE_SIZE}`
    );
    expect(actualPage).toEqual(mockPage);
  });

  it('should send only the external-payment command contract', async () => {
    const inputRequest: CreateExternalPaymentRequest = {
      registrationId: '6adf7e80-3035-4d12-a2d4-45c591bb2441',
      amount: 125.5,
      currency: 'USD',
      externalMethod: 'CHECK',
      externalReference: 'check-123',
      idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
    };
    const mockPayment = {
      id: 'payment-id',
      ...inputRequest,
      userId: 'server-derived-owner',
    };
    mockApiPost.mockResolvedValue({ data: mockPayment });

    await adminPaymentsApi.recordExternalPayment(inputRequest);

    expect(mockApiPost).toHaveBeenCalledWith('/payments/external', inputRequest);
    expect(mockApiPost.mock.calls[0]?.[1]).not.toHaveProperty('userId');
  });

  it('should send integer cents to the payment-attached manual refund route', async () => {
    const inputRequest: CreateManualRefundRequest = {
      amountCents: 5050,
      executionMode: 'MANUAL',
      reason: 'duplicate charge',
      externalReference: 'refund-123',
      resultingRegistrationStatus: 'WAITLISTED',
      idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
    };
    const mockResult = {
      payment: { id: 'payment-id' },
      refund: { id: 'refund-id', amountCents: 5050 },
      paymentAmountCents: 10000,
      successfulRefundCents: 5050,
      pendingRefundCents: 0,
      availableRefundCents: 4950,
      refundUnavailableReason: null,
    };
    mockApiPost.mockResolvedValue({ data: mockResult });

    const actualResult = await adminPaymentsApi.createRefund('payment-id', inputRequest);

    expect(mockApiPost).toHaveBeenCalledWith('/payments/payment-id/refunds', inputRequest);
    expect(mockApiPost.mock.calls[0]?.[1]).not.toHaveProperty('currency');
    expect(mockApiPost.mock.calls[0]?.[1]).not.toHaveProperty('availableRefundCents');
    expect(actualResult).toEqual(mockResult);
  });

  it('should send Stripe mode without manual or derived fields', async () => {
    const inputRequest = {
      fullRefund: true as const,
      executionMode: 'STRIPE' as const,
      reason: 'customer request',
      idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
    };
    mockApiPost.mockResolvedValue({ data: { outcome: 'PENDING_UNKNOWN' } });

    await adminPaymentsApi.createRefund('payment-id', inputRequest);

    expect(mockApiPost).toHaveBeenCalledWith('/payments/payment-id/refunds', inputRequest);
    expect(mockApiPost.mock.calls[0]?.[1]).not.toHaveProperty('externalReference');
    expect(mockApiPost.mock.calls[0]?.[1]).not.toHaveProperty('currency');
  });

  it('should retry the exact nested refund route without mutable data', async () => {
    mockApiPost.mockResolvedValue({ data: { outcome: 'PENDING_UNKNOWN' } });

    await adminPaymentsApi.retryStripeRefund('payment-id', 'refund-id');

    expect(mockApiPost).toHaveBeenCalledWith(
      '/payments/payment-id/refunds/refund-id/retry'
    );
  });

  it('should require exactly one manual refund amount selection at compile time', () => {
    const inputCommon = {
      executionMode: 'MANUAL' as const,
      idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
    };
    const inputPartialRequest = {
      ...inputCommon,
      amountCents: 5050,
    };
    const inputFullRequest = {
      ...inputCommon,
      fullRefund: true as const,
    };
    const inputMissingSelection = inputCommon;
    const inputBothSelections = {
      ...inputCommon,
      amountCents: 5050,
      fullRefund: true as const,
    };
    // @ts-expect-error -- A refund amount selection is required.
    const invalidMissingSelection: CreateManualRefundRequest = inputMissingSelection;
    // @ts-expect-error -- Partial and full refund selections are mutually exclusive.
    const invalidBothSelections: CreateManualRefundRequest = inputBothSelections;

    expectTypeOf(inputPartialRequest).toMatchTypeOf<CreateManualRefundRequest>();
    expectTypeOf(inputFullRequest).toMatchTypeOf<CreateManualRefundRequest>();
    expectTypeOf(inputMissingSelection).not.toMatchTypeOf<CreateManualRefundRequest>();
    expectTypeOf(inputBothSelections).not.toMatchTypeOf<CreateManualRefundRequest>();
    expect(invalidMissingSelection).toBe(inputMissingSelection);
    expect(invalidBothSelections).toBe(inputBothSelections);
  });

  it('should send a full selection without amount cents to the manual refund route', async () => {
    const inputRequest: CreateManualRefundRequest = {
      fullRefund: true,
      executionMode: 'MANUAL',
      idempotencyKey: '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
    };
    mockApiPost.mockResolvedValue({ data: { refund: { id: 'refund-id' } } });

    await adminPaymentsApi.createRefund('payment-id', inputRequest);

    expect(mockApiPost).toHaveBeenCalledWith('/payments/payment-id/refunds', inputRequest);
    expect(mockApiPost.mock.calls[0]?.[1]).not.toHaveProperty('amountCents');
  });
});
