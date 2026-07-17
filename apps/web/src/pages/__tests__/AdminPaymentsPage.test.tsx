import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPaymentsPage from '../AdminPaymentsPage';
import {
  adminRegistrationsApi,
  type Registration,
} from '../../lib/api/admin-registrations';
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
  const actual = await vi.importActual<
    typeof import('../../lib/api/admin-payments')
  >('../../lib/api/admin-payments');
  return {
    ...actual,
    adminPaymentsApi: {
      getPayments: vi.fn(),
      recordExternalPayment: vi.fn(),
    },
  };
});

const mockGetRegistrations = vi.mocked(
  adminRegistrationsApi.getRegistrations,
);
const mockGetPayments = vi.mocked(adminPaymentsApi.getPayments);
const mockRecordExternalPayment = vi.mocked(
  adminPaymentsApi.recordExternalPayment,
);

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
};

function createAxiosError(
  status: number,
  message: string | string[],
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
    </MemoryRouter>,
  );
}

async function searchAndSelectRegistration(): Promise<void> {
  fireEvent.change(screen.getByLabelText('Registration name'), {
    target: { value: 'Pat' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Search registrations' }),
  );
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
    expect(
      screen.getByRole('button', { name: 'Search registrations' }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Registration name'), {
      target: { value: 'Pat' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Search registrations' }),
    );

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
      screen.getByText(/does not charge Stripe, PayPal, or any other processor/),
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Record external payment' }),
    );

    expect(await screen.findByText('Temporary request failure')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Record external payment' }),
    );

    await screen.findByText('External payment recorded');
    expect(mockRecordExternalPayment).toHaveBeenCalledTimes(2);
    const firstRequest = mockRecordExternalPayment.mock.calls[0]?.[0];
    const secondRequest = mockRecordExternalPayment.mock.calls[1]?.[0];
    expect(firstRequest?.idempotencyKey).toBe(
      '43ea4b84-1f0d-413d-bc1c-9c91b435d66d',
    );
    expect(secondRequest?.idempotencyKey).toBe(firstRequest?.idempotencyKey);
    expect(secondRequest).not.toHaveProperty('userId');
    expect(mockGetPayments).toHaveBeenLastCalledWith(0, 25);
    expect(screen.getByText(/payment-id: USD 125.50/)).toBeInTheDocument();
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
    expect(
      screen.getByRole('button', { name: 'Record external payment' }),
    ).toBeDisabled();
    expect(mockRecordExternalPayment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Confirm external payment'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Record external payment' }),
    );

    await waitFor(() => {
      expect(mockRecordExternalPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationId: secondRegistration.id,
        }),
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
      mockRecordExternalPayment.mockRejectedValue(
        createAxiosError(status, serverMessage),
      );
      renderPage();
      await searchAndSelectRegistration();
      completePaymentForm();

      fireEvent.click(
        screen.getByRole('button', { name: 'Record external payment' }),
      );

      expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
    },
  );

  it('should bound actionable server guidance to 500 characters', async () => {
    const inputMessage = `Action required: ${'x'.repeat(600)}`;
    mockRecordExternalPayment.mockRejectedValue(
      createAxiosError(400, inputMessage),
    );
    renderPage();
    await searchAndSelectRegistration();
    completePaymentForm();

    fireEvent.click(
      screen.getByRole('button', { name: 'Record external payment' }),
    );

    const actualAlert = await screen.findByRole('alert');
    expect(actualAlert).toHaveTextContent(inputMessage.slice(0, 500));
    expect(actualAlert.textContent).toHaveLength(500);
  });

  it('should hide internal server details for 5xx failures', async () => {
    mockRecordExternalPayment.mockRejectedValue(
      createAxiosError(500, 'Internal database connection details'),
    );
    renderPage();
    await searchAndSelectRegistration();
    completePaymentForm();

    fireEvent.click(
      screen.getByRole('button', { name: 'Record external payment' }),
    );

    expect(
      await screen.findByText('Unable to record the external payment.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Internal database connection details'),
    ).not.toBeInTheDocument();
  });
});
