import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPaymentsPage from '../AdminPaymentsPage';
import { adminRegistrationsApi, type Registration } from '../../lib/api/admin-registrations';
import {
  adminPaymentsApi,
  type ExternalPaymentSearchRegistration,
} from '../../lib/api/admin-payments';

void adminRegistrationsApi.getRegistrations<Registration>;
void adminRegistrationsApi.getRegistrations<ExternalPaymentSearchRegistration>;
// @ts-expect-error unrelated shapes must not be valid registration results
void adminRegistrationsApi.getRegistrations<{ unrelated: string }>;

vi.mock('../../lib/api/admin-registrations', () => ({
  adminRegistrationsApi: {
    getRegistrations: vi.fn(),
  },
}));

vi.mock('../../lib/api/admin-payments', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api/admin-payments')>(
    '../../lib/api/admin-payments'
  );
  return {
    ...actual,
    adminPaymentsApi: {
      getPayments: vi.fn(),
      recordExternalPayment: vi.fn(),
      createRefund: vi.fn(),
      retryStripeRefund: vi.fn(),
    },
  };
});

const mockGetRegistrations = vi.mocked(adminRegistrationsApi.getRegistrations);
const mockGetPayments = vi.mocked(adminPaymentsApi.getPayments);
const mockRecordExternalPayment = vi.mocked(adminPaymentsApi.recordExternalPayment);
const mockCreateRefund = vi.mocked(adminPaymentsApi.createRefund);
const mockRetryStripeRefund = vi.mocked(adminPaymentsApi.retryStripeRefund);

const registration = {
  id: '6adf7e80-3035-4d12-a2d4-45c591bb2441',
  year: 2026,
  status: 'PENDING' as const,
  paymentDeferred: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  user: {
    id: 'server-derived-owner',
    email: 'pat@example.com',
    firstName: 'Pat',
    lastName: 'Participant',
    role: 'PARTICIPANT',
  },
  jobs: [],
  payments: [],
};

const secondRegistration = {
  ...registration,
  id: '8c14b60a-8c68-4e09-8a7c-09c6964e420d',
  status: 'WAITLISTED' as const,
  user: {
    ...registration.user,
    id: 'second-server-derived-owner',
    email: 'sam@example.com',
    firstName: 'Sam',
    lastName: 'Second',
  },
};

const payment = {
  id: 'payment-id',
  amount: 125.5,
  currency: 'USD',
  status: 'COMPLETED',
  provider: 'MANUAL',
  externalMethod: 'CHECK' as const,
  externalReference: 'check-123',
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
  userId: registration.user.id,
  registrationId: registration.id,
  user: registration.user,
  registration: {
    id: registration.id,
    year: registration.year,
    status: 'CONFIRMED',
  },
  refunds: [],
  paymentAmountCents: 12550,
  successfulRefundCents: 0,
  pendingRefundCents: 0,
  availableRefundCents: 12550,
  refundUnavailableReason: null,
  stripeRefundEligible: false,
};

function createAxiosError(
  status: number,
  message: string | string[]
): Error & {
  readonly isAxiosError: true;
  readonly response: {
    readonly status: number;
    readonly data: { readonly message: string | string[] };
  };
} {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true as const,
    response: {
      status,
      data: { message },
    },
  });
}

function renderPage(): void {
  render(
    <MemoryRouter>
      <AdminPaymentsPage />
    </MemoryRouter>
  );
}

async function searchAndSelectRegistration(): Promise<void> {
  fireEvent.change(screen.getByLabelText('Registration name'), {
    target: { value: 'Pat' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search registrations' }));
  await screen.findByText('pat@example.com');
  fireEvent.click(screen.getByLabelText('Select Pat Participant'));
}

function completePaymentForm(): void {
  fireEvent.change(screen.getByLabelText('External payment amount'), {
    target: { value: '125.50' },
  });
  fireEvent.click(screen.getByLabelText('Confirm external payment'));
}

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('43ea4b84-1f0d-413d-bc1c-9c91b435d66d')
      .mockReturnValue('5aa6395d-f220-408a-8458-47b465b18de5');
    mockGetPayments.mockResolvedValue({ payments: [], total: 0 });
    mockGetRegistrations.mockResolvedValue({
      registrations: [registration],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
    });
  });

  it('should search only after meaningful input and show the derived owner', async () => {
    renderPage();

    expect(mockGetRegistrations).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Search registrations' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Registration name'), {
      target: { value: 'Pat' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search registrations' }));

    await waitFor(() => {
      expect(mockGetRegistrations).toHaveBeenCalledWith({
        name: 'Pat',
        email: undefined,
        year: undefined,
        status: undefined,
      });
    });
    expect(await screen.findByText('pat@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select Pat Participant'));

    expect(screen.getByText(/The registration will become CONFIRMED/)).toBeInTheDocument();
    expect(
      screen.getByText(/does not charge Stripe, PayPal, or any other processor/)
    ).toBeInTheDocument();
  });

  it('should retain one idempotency key across a failed retry and refresh after success', async () => {
    mockRecordExternalPayment
      .mockRejectedValueOnce(new Error('Temporary request failure'))
      .mockResolvedValueOnce(payment);
    mockGetPayments
      .mockResolvedValueOnce({ payments: [], total: 0 })
      .mockResolvedValue({ payments: [payment], total: 1 });
    renderPage();
    await searchAndSelectRegistration();

    fireEvent.change(screen.getByLabelText('External payment amount'), {
      target: { value: '125.50' },
    });
    fireEvent.change(screen.getByLabelText('External payment method'), {
      target: { value: 'CHECK' },
    });
    fireEvent.change(screen.getByLabelText('External payment reference'), {
      target: { value: 'check-123' },
    });
    fireEvent.click(screen.getByLabelText('Confirm external payment'));
    fireEvent.click(screen.getByRole('button', { name: 'Record external payment' }));

    expect(await screen.findByText('Temporary request failure')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Record external payment' }));

    await screen.findByText('External payment recorded');
    expect(mockRecordExternalPayment).toHaveBeenCalledTimes(2);
    const firstRequest = mockRecordExternalPayment.mock.calls[0]?.[0];
    const secondRequest = mockRecordExternalPayment.mock.calls[1]?.[0];
    expect(firstRequest?.idempotencyKey).toBe('43ea4b84-1f0d-413d-bc1c-9c91b435d66d');
    expect(secondRequest?.idempotencyKey).toBe(firstRequest?.idempotencyKey);
    expect(secondRequest).not.toHaveProperty('userId');
    expect(mockGetPayments).toHaveBeenLastCalledWith(0, 25);
    expect(screen.getByText(/payment-id: USD 125.50/)).toBeInTheDocument();
  });

  it('should convert a two-decimal partial amount once, retain idempotency on failure, and refresh after success', async () => {
    const refundedPayment = {
      ...payment,
      status: 'PARTIALLY_REFUNDED',
      refunds: [
        {
          id: 'refund-id',
          amountCents: 5050,
          currency: 'USD',
          executionMode: 'MANUAL' as const,
          status: 'SUCCEEDED' as const,
          reason: 'duplicate charge',
          externalReference: 'refund-123',
          resultingRegistrationStatus: 'WAITLISTED' as const,
          createdAt: '2026-07-14T01:00:00.000Z',
          updatedAt: '2026-07-14T01:00:00.000Z',
        },
      ],
      successfulRefundCents: 5050,
      availableRefundCents: 7500,
    };
    const refundResult = {
      payment: refundedPayment,
      refund: refundedPayment.refunds[0],
      paymentAmountCents: 12550,
      successfulRefundCents: 5050,
      pendingRefundCents: 0,
      availableRefundCents: 7500,
    };
    mockGetPayments
      .mockResolvedValueOnce({ payments: [payment], total: 1 })
      .mockResolvedValue({ payments: [refundedPayment], total: 1 });
    const axiosError = Object.assign(new Error('Request failed with status code 409'), {
      isAxiosError: true as const,
      response: {
        data: {
          message: 'Refund balance changed concurrently; refresh the payment and retry',
          internalDetails: 'do not expose this payload',
        },
        status: 409,
      },
    });
    mockCreateRefund.mockRejectedValueOnce(axiosError).mockResolvedValueOnce({
      ...refundResult,
      outcome: 'SUCCEEDED',
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));
    expect(
      screen.getByText(/does not contact Stripe, PayPal, or another processor/)
    ).toBeInTheDocument();
    expect(screen.getByText(/A full refund does not cancel the registration/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Partial refund amount'), {
      target: { value: '50.50' },
    });
    fireEvent.change(screen.getByLabelText('Manual refund reason'), {
      target: { value: 'duplicate charge' },
    });
    fireEvent.change(screen.getByLabelText('Manual refund reference'), {
      target: { value: 'refund-123' },
    });
    fireEvent.change(screen.getByLabelText('Refund registration status'), {
      target: { value: 'WAITLISTED' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record manual refund' }));

    expect(
      await screen.findByText('Refund balance changed concurrently; refresh the payment and retry')
    ).toBeInTheDocument();
    expect(screen.queryByText('do not expose this payload')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Record manual refund' }));

    expect(await screen.findByText('Manual refund recorded: USD 50.50.')).toBeInTheDocument();
    expect(mockCreateRefund).toHaveBeenCalledTimes(2);
    const firstRequest = mockCreateRefund.mock.calls[0]?.[1];
    const secondRequest = mockCreateRefund.mock.calls[1]?.[1];
    expect(firstRequest).toEqual(
      expect.objectContaining({
        amountCents: 5050,
        executionMode: 'MANUAL',
        reason: 'duplicate charge',
        externalReference: 'refund-123',
        resultingRegistrationStatus: 'WAITLISTED',
      })
    );
    expect(firstRequest).not.toHaveProperty('currency');
    expect(secondRequest?.idempotencyKey).toBe(firstRequest?.idempotencyKey);
    expect(mockGetPayments).toHaveBeenLastCalledWith(0, 25);
  });

  it('should use the full available shortcut and hide actions for ledgerless refunded payments', async () => {
    const legacyRefundedPayment = {
      ...payment,
      id: 'legacy-refunded',
      status: 'REFUNDED',
      refunds: [],
      successfulRefundCents: 12550,
      availableRefundCents: 0,
    };
    const fullyRefundedPayment = {
      ...payment,
      status: 'REFUNDED',
      successfulRefundCents: 12550,
      availableRefundCents: 0,
    };
    mockGetPayments
      .mockResolvedValueOnce({
        payments: [payment, legacyRefundedPayment],
        total: 2,
      })
      .mockResolvedValue({
        payments: [fullyRefundedPayment, legacyRefundedPayment],
        total: 2,
      });
    mockCreateRefund.mockResolvedValue({
      payment: fullyRefundedPayment,
      refund: {
        id: 'full-refund',
        amountCents: 12550,
        currency: 'USD',
        executionMode: 'MANUAL',
        status: 'SUCCEEDED',
        reason: null,
        externalReference: null,
        resultingRegistrationStatus: null,
        createdAt: '2026-07-14T01:00:00.000Z',
        updatedAt: '2026-07-14T01:00:00.000Z',
      },
      paymentAmountCents: 12550,
      successfulRefundCents: 12550,
      pendingRefundCents: 0,
      availableRefundCents: 0,
      refundUnavailableReason: null,
      outcome: 'SUCCEEDED',
    });
    renderPage();

    expect(await screen.findAllByText('No ledger history')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Refund' })).toHaveLength(1);
    expect(screen.getAllByText('Unavailable')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    fireEvent.click(screen.getByLabelText('Full available refund'));
    fireEvent.click(screen.getByRole('button', { name: 'Record manual refund' }));

    await screen.findByText('Manual refund recorded: USD 125.50.');
    expect(mockCreateRefund).toHaveBeenCalledWith(
      'payment-id',
      expect.objectContaining({
        fullRefund: true,
        executionMode: 'MANUAL',
      })
    );
    expect(mockCreateRefund.mock.calls[0]?.[1]).not.toHaveProperty('amountCents');
  });

  it('should show a legacy precision reason without rounding or offering a refund action', async () => {
    const legacyPrecisionPayment = {
      ...payment,
      id: 'legacy-precision-payment',
      amount: 10.001,
      paymentAmountCents: null,
      availableRefundCents: 0,
      refundUnavailableReason:
        'Refund unavailable because the stored payment amount has unsupported precision.',
    };
    mockGetPayments.mockResolvedValue({
      payments: [legacyPrecisionPayment],
      total: 1,
    });

    renderPage();

    expect(await screen.findByText('USD 10.001')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Refund unavailable because the stored payment amount has unsupported precision.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
  });

  it('should show an invalid stored currency reason without normalizing or offering a refund', async () => {
    const legacyCurrencyPayment = {
      ...payment,
      id: 'legacy-currency-payment',
      currency: 'usd',
      refundUnavailableReason: 'Refund unavailable because the stored payment currency is invalid.',
      availableRefundCents: 0,
    };
    mockGetPayments.mockResolvedValue({
      payments: [legacyCurrencyPayment],
      total: 1,
    });

    renderPage();

    expect(await screen.findByText('usd 125.50')).toBeInTheDocument();
    expect(
      screen.getByText('Refund unavailable because the stored payment currency is invalid.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
  });

  it('should hide an internal 500 message behind the safe refund fallback', async () => {
    const axiosError = Object.assign(new Error('Request failed with status code 500'), {
      isAxiosError: true as const,
      response: {
        data: {
          message: 'Internal database connection details',
        },
        status: 500,
      },
    });
    mockGetPayments.mockResolvedValue({ payments: [payment], total: 1 });
    mockCreateRefund.mockRejectedValue(axiosError);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));
    fireEvent.change(screen.getByLabelText('Partial refund amount'), {
      target: { value: '1.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record manual refund' }));

    expect(await screen.findByText('Unable to record the manual refund.')).toBeInTheDocument();
    expect(screen.queryByText('Internal database connection details')).not.toBeInTheDocument();
  });

  it('should show actionable refund validation arrays for a 400 response', async () => {
    mockGetPayments.mockResolvedValue({ payments: [payment], total: 1 });
    mockCreateRefund.mockRejectedValue(
      createAxiosError(400, [
        'amountCents must be within the supported range',
        'reason must not exceed 500 characters',
      ])
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));
    fireEvent.change(screen.getByLabelText('Partial refund amount'), {
      target: { value: '1.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record manual refund' }));

    expect(
      await screen.findByText(
        'amountCents must be within the supported range; reason must not exceed 500 characters'
      )
    ).toBeInTheDocument();
  });

  it.each(['1.001', '125.51'])(
    'should reject invalid or excessive partial amount %s before submission',
    async inputAmount => {
      mockGetPayments.mockResolvedValue({ payments: [payment], total: 1 });
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));
      fireEvent.change(screen.getByLabelText('Partial refund amount'), {
        target: { value: inputAmount },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Record manual refund' }));

      expect(
        await screen.findByText(/Enter a positive amount with at most two decimals/)
      ).toBeInTheDocument();
      expect(mockCreateRefund).not.toHaveBeenCalled();
    }
  );

  it('should offer Stripe mode only for an eligible Stripe payment with distinct copy', async () => {
    const stripePayment = {
      ...payment,
      provider: 'STRIPE',
      externalMethod: null,
      externalReference: null,
      stripeRefundEligible: true,
    };
    mockGetPayments.mockResolvedValue({ payments: [stripePayment], total: 1 });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));
    expect(screen.getByLabelText('Initiate Stripe refund')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Initiate Stripe refund'));

    expect(screen.getByText(/Stripe mode initiates a processor refund/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Manual refund reference')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Initiate Stripe refund' })).toBeInTheDocument();
    expect(screen.getByText(/A full refund does not cancel the registration/)).toBeInTheDocument();
  });

  it('should keep an ambiguous Stripe refund reserved and retry it from history', async () => {
    const pendingRefund = {
      id: 'pending-refund',
      amountCents: 2500,
      currency: 'USD',
      executionMode: 'STRIPE' as const,
      status: 'PENDING' as const,
      reason: 'customer request',
      externalReference: null,
      resultingRegistrationStatus: null,
      createdAt: '2026-07-14T01:00:00.000Z',
      updatedAt: '2026-07-14T01:00:00.000Z',
    };
    const stripePayment = {
      ...payment,
      provider: 'STRIPE',
      externalMethod: null,
      externalReference: null,
      stripeRefundEligible: true,
    };
    const pendingPayment = {
      ...stripePayment,
      refunds: [pendingRefund],
      pendingRefundCents: 2500,
      availableRefundCents: 10050,
    };
    const succeededPayment = {
      ...pendingPayment,
      status: 'PARTIALLY_REFUNDED',
      refunds: [{ ...pendingRefund, status: 'SUCCEEDED' as const }],
      successfulRefundCents: 2500,
      pendingRefundCents: 0,
    };
    mockGetPayments
      .mockResolvedValueOnce({ payments: [stripePayment], total: 1 })
      .mockResolvedValueOnce({ payments: [pendingPayment], total: 1 })
      .mockResolvedValue({ payments: [succeededPayment], total: 1 });
    mockCreateRefund.mockResolvedValue({
      payment: pendingPayment,
      refund: pendingRefund,
      paymentAmountCents: 12550,
      successfulRefundCents: 0,
      pendingRefundCents: 2500,
      availableRefundCents: 10050,
      refundUnavailableReason: null,
      outcome: 'PENDING_UNKNOWN',
    });
    mockRetryStripeRefund.mockResolvedValue({
      payment: succeededPayment,
      refund: succeededPayment.refunds[0],
      paymentAmountCents: 12550,
      successfulRefundCents: 2500,
      pendingRefundCents: 0,
      availableRefundCents: 10050,
      refundUnavailableReason: null,
      outcome: 'SUCCEEDED',
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));
    fireEvent.click(screen.getByLabelText('Initiate Stripe refund'));
    fireEvent.change(screen.getByLabelText('Partial refund amount'), {
      target: { value: '25.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Initiate Stripe refund' }));

    expect(await screen.findByText(/Stripe outcome is pending or unknown/)).toBeInTheDocument();
    expect(mockCreateRefund.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        amountCents: 2500,
        executionMode: 'STRIPE',
      })
    );
    expect(mockCreateRefund.mock.calls[0]?.[1]).not.toHaveProperty('externalReference');
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await screen.findByText('Stripe refund reconciliation succeeded.');
    expect(mockRetryStripeRefund).toHaveBeenCalledWith('payment-id', 'pending-refund');
    expect(mockGetPayments).toHaveBeenLastCalledWith(0, 25);
  });

  it.each([
    ['SUCCEEDED', 'SUCCEEDED', 'Stripe refund reconciliation succeeded.'],
    [
      'PENDING_UNKNOWN',
      'PENDING',
      'Stripe outcome remains pending or unknown; the amount is still reserved.',
    ],
    ['FAILED', 'FAILED', 'Stripe rejected the refund. Its reserved balance has been released.'],
  ] as const)(
    'should render direct Stripe retry outcome %s without manual recording context',
    async (outcome, refundStatus, expectedMessage) => {
      const pendingRefund = {
        id: 'pending-refund',
        amountCents: 2500,
        currency: 'USD',
        executionMode: 'STRIPE' as const,
        status: 'PENDING' as const,
        reason: null,
        externalReference: null,
        resultingRegistrationStatus: null,
        createdAt: '2026-07-14T01:00:00.000Z',
        updatedAt: '2026-07-14T01:00:00.000Z',
      };
      const pendingPayment = {
        ...payment,
        provider: 'STRIPE',
        stripeRefundEligible: true,
        refunds: [pendingRefund],
        pendingRefundCents: 2500,
        availableRefundCents: 10050,
      };
      const resultRefund = { ...pendingRefund, status: refundStatus };
      mockGetPayments.mockResolvedValue({ payments: [pendingPayment], total: 1 });
      mockRetryStripeRefund.mockResolvedValue({
        payment: {
          ...pendingPayment,
          status: outcome === 'SUCCEEDED' ? 'PARTIALLY_REFUNDED' : pendingPayment.status,
          refunds: [resultRefund],
          successfulRefundCents: outcome === 'SUCCEEDED' ? 2500 : 0,
          pendingRefundCents: outcome === 'PENDING_UNKNOWN' ? 2500 : 0,
          availableRefundCents: outcome === 'PENDING_UNKNOWN' ? 10050 : 12550,
        },
        refund: resultRefund,
        paymentAmountCents: 12550,
        successfulRefundCents: outcome === 'SUCCEEDED' ? 2500 : 0,
        pendingRefundCents: outcome === 'PENDING_UNKNOWN' ? 2500 : 0,
        availableRefundCents: outcome === 'PENDING_UNKNOWN' ? 10050 : 12550,
        refundUnavailableReason: null,
        outcome,
      });
      renderPage();

      if (outcome === 'SUCCEEDED') {
        fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));
        expect(
          screen.getByRole('heading', { name: 'Record completed manual refund' })
        ).toBeInTheDocument();
      }
      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

      expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Reconcile Stripe refund' })).toBeInTheDocument();
      expect(
        screen.getByText(/Retry inspects Stripe before deciding whether the stored request/)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Record completed manual refund' })
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Manual mode records a refund/)).not.toBeInTheDocument();
    }
  );

  it('should render a direct Stripe retry error without manual recording context', async () => {
    const pendingRefund = {
      id: 'pending-refund',
      amountCents: 2500,
      currency: 'USD',
      executionMode: 'STRIPE' as const,
      status: 'PENDING' as const,
      reason: null,
      externalReference: null,
      resultingRegistrationStatus: null,
      createdAt: '2026-07-14T01:00:00.000Z',
      updatedAt: '2026-07-14T01:00:00.000Z',
    };
    mockGetPayments.mockResolvedValue({
      payments: [
        {
          ...payment,
          provider: 'STRIPE',
          stripeRefundEligible: true,
          refunds: [pendingRefund],
          pendingRefundCents: 2500,
          availableRefundCents: 10050,
        },
      ],
      total: 1,
    });
    mockRetryStripeRefund.mockRejectedValue(new Error('Retry unavailable'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Retry unavailable');
    expect(screen.getByRole('heading', { name: 'Reconcile Stripe refund' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Record completed manual refund' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Manual mode records a refund/)).not.toBeInTheDocument();
  });

  it('should show a definite Stripe failure and released reservation', async () => {
    const failedRefund = {
      id: 'failed-refund',
      amountCents: 2500,
      currency: 'USD',
      executionMode: 'STRIPE' as const,
      status: 'FAILED' as const,
      reason: null,
      externalReference: null,
      resultingRegistrationStatus: null,
      createdAt: '2026-07-14T01:00:00.000Z',
      updatedAt: '2026-07-14T01:00:00.000Z',
    };
    const stripePayment = {
      ...payment,
      provider: 'STRIPE',
      stripeRefundEligible: true,
    };
    const failedPayment = {
      ...stripePayment,
      refunds: [failedRefund],
    };
    mockGetPayments
      .mockResolvedValueOnce({ payments: [stripePayment], total: 1 })
      .mockResolvedValue({ payments: [failedPayment], total: 1 });
    mockCreateRefund.mockResolvedValue({
      payment: failedPayment,
      refund: failedRefund,
      paymentAmountCents: 12550,
      successfulRefundCents: 0,
      pendingRefundCents: 0,
      availableRefundCents: 12550,
      refundUnavailableReason: null,
      outcome: 'FAILED',
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));
    fireEvent.click(screen.getByLabelText('Initiate Stripe refund'));
    fireEvent.change(screen.getByLabelText('Partial refund amount'), {
      target: { value: '25.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Initiate Stripe refund' }));

    expect(await screen.findByText(/Stripe rejected the refund/)).toBeInTheDocument();
    expect(await screen.findByText(/USD 25.00 FAILED \/ STRIPE/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('should require confirmation again after selecting another registration', async () => {
    mockGetRegistrations.mockResolvedValue({
      registrations: [registration, secondRegistration],
      total: 2,
      page: 1,
      limit: 25,
      totalPages: 1,
    });
    mockRecordExternalPayment.mockResolvedValue({
      ...payment,
      registrationId: secondRegistration.id,
      userId: secondRegistration.user.id,
      user: secondRegistration.user,
      registration: {
        id: secondRegistration.id,
        year: secondRegistration.year,
        status: secondRegistration.status,
      },
    });
    renderPage();
    await searchAndSelectRegistration();
    completePaymentForm();

    fireEvent.click(screen.getByLabelText('Select Sam Second'));

    expect(screen.getByLabelText('Confirm external payment')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Record external payment' })).toBeDisabled();
    expect(mockRecordExternalPayment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Confirm external payment'));
    fireEvent.click(screen.getByRole('button', { name: 'Record external payment' }));

    await waitFor(() => {
      expect(mockRecordExternalPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationId: secondRegistration.id,
        })
      );
    });
  });

  it.each([
    {
      status: 400,
      serverMessage: ['Amount must be positive', 'Currency must be valid'],
      expectedMessage: 'Amount must be positive; Currency must be valid',
    },
    {
      status: 404,
      serverMessage: 'Registration no longer exists',
      expectedMessage: 'Registration no longer exists',
    },
    {
      status: 409,
      serverMessage: 'Idempotency key was reused with different input',
      expectedMessage: 'Idempotency key was reused with different input',
    },
  ])(
    'should show actionable $status server guidance',
    async ({ status, serverMessage, expectedMessage }) => {
      mockRecordExternalPayment.mockRejectedValue(createAxiosError(status, serverMessage));
      renderPage();
      await searchAndSelectRegistration();
      completePaymentForm();

      fireEvent.click(screen.getByRole('button', { name: 'Record external payment' }));

      expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
    }
  );

  it('should bound actionable server guidance to 500 characters', async () => {
    const inputMessage = `Action required: ${'x'.repeat(600)}`;
    mockRecordExternalPayment.mockRejectedValue(createAxiosError(400, inputMessage));
    renderPage();
    await searchAndSelectRegistration();
    completePaymentForm();

    fireEvent.click(screen.getByRole('button', { name: 'Record external payment' }));

    const actualAlert = await screen.findByRole('alert');
    expect(actualAlert).toHaveTextContent(inputMessage.slice(0, 500));
    expect(actualAlert.textContent).toHaveLength(500);
  });

  it('should hide internal server details for 5xx failures', async () => {
    mockRecordExternalPayment.mockRejectedValue(
      createAxiosError(500, 'Internal database connection details')
    );
    renderPage();
    await searchAndSelectRegistration();
    completePaymentForm();

    fireEvent.click(screen.getByRole('button', { name: 'Record external payment' }));

    expect(await screen.findByText('Unable to record the external payment.')).toBeInTheDocument();
    expect(screen.queryByText('Internal database connection details')).not.toBeInTheDocument();
  });
});
