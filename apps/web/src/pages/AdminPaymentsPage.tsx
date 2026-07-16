import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import {
  adminRegistrationsApi,
  RegistrationFilters,
} from '../lib/api/admin-registrations';
import {
  ADMIN_PAYMENT_PAGE_SIZE,
  AdminPayment,
  adminPaymentsApi,
  ExternalPaymentMethod,
  ExternalPaymentSearchRegistration,
  ExternalPaymentSearchRegistrationStatus,
} from '../lib/api/admin-payments';
import { ROUTES } from '../routes';

const ELIGIBLE_REGISTRATION_STATUSES:
  readonly ExternalPaymentSearchRegistrationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'WAITLISTED',
];

const REGISTRATION_STATUS_OPTIONS:
  readonly ExternalPaymentSearchRegistrationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'WAITLISTED',
  'CANCELLED',
  'APPLICATION_SUBMITTED',
  'APPLICATION_APPROVED',
  'APPLICATION_DECLINED',
];

const EXTERNAL_PAYMENT_METHODS: readonly ExternalPaymentMethod[] = [
  'CASH',
  'CHECK',
  'PAYPAL',
  'STRIPE',
  'BANK_TRANSFER',
  'OTHER',
];

const ACTIONABLE_SERVER_ERROR_STATUSES = new Set([400, 404, 409]);
const MAX_SERVER_ERROR_MESSAGE_LENGTH = 500;

interface ApiErrorResponse {
  readonly message?: unknown;
}

function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

function isEligibleRegistration(
  registration: ExternalPaymentSearchRegistration,
): boolean {
  return ELIGIBLE_REGISTRATION_STATUSES.includes(registration.status);
}

function getRegistrationEffect(
  registration: ExternalPaymentSearchRegistration,
): string {
  if (registration.status === 'PENDING') {
    return 'The registration will become CONFIRMED and payment deferral will be cleared.';
  }

  return `The registration will remain ${registration.status} and payment deferral will be cleared.`;
}

function normalizeServerErrorMessage(message: unknown): string | null {
  const normalizedMessage = Array.isArray(message)
    ? message
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .join('; ')
    : typeof message === 'string'
      ? message.trim()
      : '';

  return normalizedMessage
    ? normalizedMessage.slice(0, MAX_SERVER_ERROR_MESSAGE_LENGTH)
    : null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiErrorResponse>(error)) {
    const status = error.response?.status;
    if (!status || !ACTIONABLE_SERVER_ERROR_STATUSES.has(status)) {
      return fallback;
    }

    return (
      normalizeServerErrorMessage(error.response?.data?.message) ?? fallback
    );
  }

  return error instanceof Error ? error.message : fallback;
}

/**
 * Admin-only workflow for recording completed payments made outside PlayaPlan.
 */
export default function AdminPaymentsPage() {
  const [registrationFilters, setRegistrationFilters] =
    useState<RegistrationFilters>({});
  const [registrationResults, setRegistrationResults] = useState<
    ExternalPaymentSearchRegistration[] | null
  >(null);
  const [selectedRegistration, setSelectedRegistration] =
    useState<ExternalPaymentSearchRegistration | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentSkip, setPaymentSkip] = useState(0);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [paymentListError, setPaymentListError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [externalMethod, setExternalMethod] =
    useState<ExternalPaymentMethod>('CASH');
  const [externalReference, setExternalReference] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successfulPayment, setSuccessfulPayment] =
    useState<AdminPayment | null>(null);

  const hasMeaningfulSearch = useMemo(() => {
    const hasName = (registrationFilters.name?.trim().length ?? 0) >= 2;
    const hasEmail = (registrationFilters.email?.trim().length ?? 0) >= 2;
    return Boolean(
      hasName ||
        hasEmail ||
        registrationFilters.year ||
        registrationFilters.status,
    );
  }, [registrationFilters]);

  const loadPayments = useCallback(async (skip: number): Promise<void> => {
    setIsLoadingPayments(true);
    setPaymentListError(null);
    try {
      const paymentPage = await adminPaymentsApi.getPayments(
        skip,
        ADMIN_PAYMENT_PAGE_SIZE,
      );
      setPayments(paymentPage.payments);
      setPaymentTotal(paymentPage.total);
    } catch (error: unknown) {
      setPaymentListError(
        getErrorMessage(error, 'Unable to load admin payments.'),
      );
    } finally {
      setIsLoadingPayments(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments(paymentSkip);
  }, [loadPayments, paymentSkip]);

  const updateRegistrationFilter = (
    key: keyof RegistrationFilters,
    value: string,
  ): void => {
    setRegistrationFilters((currentFilters) => ({
      ...currentFilters,
      [key]:
        value === ''
          ? undefined
          : key === 'year'
            ? Number.parseInt(value, 10)
            : value,
    }));
  };

  const searchRegistrations = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!hasMeaningfulSearch) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSelectedRegistration(null);
    try {
      const result =
        await adminRegistrationsApi.getRegistrations<ExternalPaymentSearchRegistration>(
          {
            name: registrationFilters.name?.trim() || undefined,
            email: registrationFilters.email?.trim() || undefined,
            year: registrationFilters.year,
            status: registrationFilters.status,
          },
        );
      setRegistrationResults(result.registrations);
    } catch (error: unknown) {
      setSearchError(
        getErrorMessage(error, 'Unable to search registrations.'),
      );
      setRegistrationResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectRegistration = (
    registration: ExternalPaymentSearchRegistration,
  ): void => {
    setSelectedRegistration(registration);
    setIsConfirmed(false);
  };

  const recordExternalPayment = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!selectedRegistration || !isConfirmed) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessfulPayment(null);
    try {
      const payment = await adminPaymentsApi.recordExternalPayment({
        registrationId: selectedRegistration.id,
        amount: Number(amount),
        currency: currency.trim().toUpperCase(),
        externalMethod,
        externalReference: externalReference.trim() || undefined,
        idempotencyKey,
      });
      setSuccessfulPayment(payment);
      setIdempotencyKey(createIdempotencyKey());
      setAmount('');
      setExternalReference('');
      setIsConfirmed(false);
      setPaymentSkip(0);
      await loadPayments(0);
    } catch (error: unknown) {
      setSubmitError(
        getErrorMessage(error, 'Unable to record the external payment.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div>
        <Link
          to={ROUTES.ADMIN.path}
          className="text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          &larr; Admin Panel
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">
          Admin Payments
        </h1>
        <p className="mt-2 text-gray-600">
          Record a payment that has already completed outside PlayaPlan. This
          form does not charge Stripe, PayPal, or any other processor.
        </p>
      </div>

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-gray-900">
          1. Find a registration
        </h2>
        <form
          className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5"
          onSubmit={searchRegistrations}
        >
          <label className="text-sm font-medium text-gray-700">
            Name
            <input
              aria-label="Registration name"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={registrationFilters.name ?? ''}
              onChange={(event) =>
                updateRegistrationFilter('name', event.target.value)
              }
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Email
            <input
              aria-label="Registration email"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              type="email"
              value={registrationFilters.email ?? ''}
              onChange={(event) =>
                updateRegistrationFilter('email', event.target.value)
              }
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Year
            <input
              aria-label="Registration year"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              min="2020"
              type="number"
              value={registrationFilters.year ?? ''}
              onChange={(event) =>
                updateRegistrationFilter('year', event.target.value)
              }
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Status
            <select
              aria-label="Registration status"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              value={registrationFilters.status ?? ''}
              onChange={(event) =>
                updateRegistrationFilter('status', event.target.value)
              }
            >
              <option value="">Any status</option>
              {REGISTRATION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <button
            className="self-end rounded bg-blue-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            disabled={!hasMeaningfulSearch || isSearching}
            type="submit"
          >
            {isSearching ? 'Searching...' : 'Search registrations'}
          </button>
        </form>
        {!hasMeaningfulSearch && (
          <p className="mt-3 text-sm text-gray-500">
            Enter at least two name/email characters or choose a year/status.
          </p>
        )}
        {searchError && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {searchError}
          </p>
        )}
        {registrationResults && (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="text-left text-sm text-gray-600">
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">Registrant</th>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registrationResults.map((registration) => {
                  const eligible = isEligibleRegistration(registration);
                  return (
                    <tr key={registration.id}>
                      <td className="px-3 py-3">
                        <input
                          aria-label={`Select ${registration.user.firstName} ${registration.user.lastName}`}
                          checked={selectedRegistration?.id === registration.id}
                          disabled={!eligible}
                          name="registration"
                          onChange={() => selectRegistration(registration)}
                          type="radio"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">
                          {registration.user.firstName}{' '}
                          {registration.user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {registration.user.email}
                        </div>
                      </td>
                      <td className="px-3 py-3">{registration.year}</td>
                      <td className="px-3 py-3">
                        {registration.status}
                        {!eligible && (
                          <span className="ml-2 text-sm text-red-700">
                            Not eligible
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {registrationResults.length === 0 && (
              <p className="py-4 text-sm text-gray-600">
                No registrations matched.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-gray-900">
          2. Record completed external payment
        </h2>
        {selectedRegistration ? (
          <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-4">
            <p className="font-medium text-blue-950">
              {selectedRegistration.user.firstName}{' '}
              {selectedRegistration.user.lastName} (
              {selectedRegistration.user.email})
            </p>
            <p className="text-sm text-blue-900">
              Registration {selectedRegistration.id} &middot;{' '}
              {selectedRegistration.year} &middot;{' '}
              {selectedRegistration.status}
            </p>
            <p className="mt-2 text-sm text-blue-900">
              {getRegistrationEffect(selectedRegistration)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            Select one eligible registration before recording a payment.
          </p>
        )}

        <form className="mt-5 space-y-4" onSubmit={recordExternalPayment}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Amount
              <input
                aria-label="External payment amount"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                min="0.01"
                required
                step="0.01"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Currency
              <input
                aria-label="External payment currency"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 uppercase"
                maxLength={3}
                minLength={3}
                pattern="[A-Za-z]{3}"
                required
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              External method
              <select
                aria-label="External payment method"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                value={externalMethod}
                onChange={(event) =>
                  setExternalMethod(event.target.value as ExternalPaymentMethod)
                }
              >
                {EXTERNAL_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              External reference (optional)
              <input
                aria-label="External payment reference"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                maxLength={255}
                value={externalReference}
                onChange={(event) => setExternalReference(event.target.value)}
              />
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              aria-label="Confirm external payment"
              checked={isConfirmed}
              className="mt-1"
              onChange={(event) => setIsConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>
              I confirm this payment already completed outside PlayaPlan and
              that the selected registration behavior shown above is correct.
            </span>
          </label>
          {submitError && (
            <p className="text-sm text-red-700" role="alert">
              {submitError}
            </p>
          )}
          <button
            className="rounded bg-green-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            disabled={
              !selectedRegistration ||
              !isConfirmed ||
              Number(amount) <= 0 ||
              isSubmitting
            }
            type="submit"
          >
            {isSubmitting ? 'Recording...' : 'Record external payment'}
          </button>
        </form>

        {successfulPayment && (
          <div
            className="mt-5 rounded border border-green-300 bg-green-50 p-4"
            role="status"
          >
            <p className="font-semibold text-green-900">
              External payment recorded
            </p>
            <p className="text-sm text-green-800">
              {successfulPayment.id}: {successfulPayment.currency}{' '}
              {successfulPayment.amount.toFixed(2)} for{' '}
              {successfulPayment.user.firstName}{' '}
              {successfulPayment.user.lastName}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-gray-900">Recent payments</h2>
        {paymentListError && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {paymentListError}
          </p>
        )}
        {isLoadingPayments ? (
          <p className="mt-3 text-sm text-gray-600">Loading payments...</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="text-left text-sm text-gray-600">
                  <th className="px-3 py-2">Registrant</th>
                  <th className="px-3 py-2">Registration</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">External details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((payment) => (
                  <tr
                    className={
                      payment.id === successfulPayment?.id ? 'bg-green-50' : ''
                    }
                    key={payment.id}
                  >
                    <td className="px-3 py-3">
                      {payment.user.firstName} {payment.user.lastName}
                      <div className="text-sm text-gray-500">
                        {payment.user.email}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {payment.registration
                        ? `${payment.registration.year} / ${payment.registration.status}`
                        : 'Not linked'}
                    </td>
                    <td className="px-3 py-3">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      {payment.currency} {payment.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-3">{payment.status}</td>
                    <td className="px-3 py-3">{payment.provider}</td>
                    <td className="px-3 py-3">
                      {payment.externalMethod ?? '—'}
                      {payment.externalReference && (
                        <div className="text-sm text-gray-500">
                          {payment.externalReference}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payments.length === 0 && (
              <p className="py-4 text-sm text-gray-600">No payments found.</p>
            )}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <button
            className="rounded border border-gray-300 px-3 py-2 text-sm disabled:text-gray-400"
            disabled={paymentSkip === 0 || isLoadingPayments}
            onClick={() =>
              setPaymentSkip((currentSkip) =>
                Math.max(0, currentSkip - ADMIN_PAYMENT_PAGE_SIZE),
              )
            }
            type="button"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            {paymentTotal === 0
              ? '0 payments'
              : `${paymentSkip + 1}-${Math.min(
                  paymentSkip + ADMIN_PAYMENT_PAGE_SIZE,
                  paymentTotal,
                )} of ${paymentTotal}`}
          </span>
          <button
            className="rounded border border-gray-300 px-3 py-2 text-sm disabled:text-gray-400"
            disabled={
              paymentSkip + ADMIN_PAYMENT_PAGE_SIZE >= paymentTotal ||
              isLoadingPayments
            }
            onClick={() =>
              setPaymentSkip(
                (currentSkip) => currentSkip + ADMIN_PAYMENT_PAGE_SIZE,
              )
            }
            type="button"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
