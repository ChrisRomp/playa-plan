import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPaymentsPage from '../AdminPaymentsPage';
import { adminRegistrationsApi } from '../../lib/api/admin-registrations';
import { adminPaymentsApi } from '../../lib/api/admin-payments';

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
      createManualRefund: vi.fn(),
    },
  };
});

const mockGetRegistrations = vi.mocked(adminRegistrationsApi.getRegistrations);
const mockGetPayments = vi.mocked(adminPaymentsApi.getPayments);
const mockRecordExternalPayment = vi.mocked(adminPaymentsApi.recordExternalPayment);
const mockCreateManualRefund = vi.mocked(adminPaymentsApi.createManualRefund);

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
};

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
    mockCreateManualRefund
      .mockRejectedValueOnce(new Error('Temporary refund failure'))
      .mockResolvedValueOnce(refundResult);
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

    expect(await screen.findByText('Temporary refund failure')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Record manual refund' }));

    expect(await screen.findByText('Manual refund recorded: USD 50.50.')).toBeInTheDocument();
    expect(mockCreateManualRefund).toHaveBeenCalledTimes(2);
    const firstRequest = mockCreateManualRefund.mock.calls[0]?.[1];
    const secondRequest = mockCreateManualRefund.mock.calls[1]?.[1];
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
    mockCreateManualRefund.mockResolvedValue({
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
    });
    renderPage();

    expect(await screen.findAllByText('No ledger history')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Refund' })).toHaveLength(1);
    expect(screen.getAllByText('Unavailable')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));
    fireEvent.click(screen.getByLabelText('Full available refund'));
    fireEvent.click(screen.getByRole('button', { name: 'Record manual refund' }));

    await screen.findByText('Manual refund recorded: USD 125.50.');
    expect(mockCreateManualRefund).toHaveBeenCalledWith(
      'payment-id',
      expect.objectContaining({
        fullRefund: true,
        executionMode: 'MANUAL',
      })
    );
    expect(mockCreateManualRefund.mock.calls[0]?.[1]).not.toHaveProperty('amountCents');
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
      expect(mockCreateManualRefund).not.toHaveBeenCalled();
    }
  );
});
