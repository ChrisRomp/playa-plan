import { useState, useEffect, useMemo, useCallback, useRef, type FormEvent } from 'react';
import { AlertTriangle, ArrowLeft, Download, Filter, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { DataTable, DataTableColumn } from '../components/common/DataTable/DataTable';
import { reports } from '../lib/api';
import {
  adminRegistrationsApi,
  type PaginatedRegistrationsResponse,
} from '../lib/api/admin-registrations';
import { Payment, RegistrationStatus } from '../types';
import { PATHS } from '../routes';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { downloadCsv } from '../utils/csv';
import { useConfig } from '../hooks/useConfig';

interface PaymentReportFilters {
  year?: number;
  status?: string;
  provider?: string;
  registrationId?: string;
}

interface ExternalPaymentFormState {
  amount: string;
  userId: string;
  registrationId: string;
  externalPaymentMethod: string;
  reference: string;
}

interface RefundFormState {
  payment: Payment;
  amount: string;
  reason: string;
  resultingRegistrationStatus: '' | RegistrationStatus;
}

type ExternalPaymentRegistration = PaginatedRegistrationsResponse['registrations'][number];

const emptyExternalPaymentForm: ExternalPaymentFormState = {
  amount: '',
  userId: '',
  registrationId: '',
  externalPaymentMethod: '',
  reference: '',
};

const formatCurrency = (amount: number | undefined): string => `$${(amount ?? 0).toFixed(2)}`;

const getRefundableAmount = (payment: Payment): number => {
  if (typeof payment.refundableAmount === 'number') {
    return payment.refundableAmount;
  }

  if (
    payment.status === 'REFUNDED' ||
    payment.status === 'FAILED' ||
    payment.status === 'PENDING'
  ) {
    return 0;
  }

  const refundedAmount =
    typeof payment.refundedAmount === 'number'
      ? payment.refundedAmount
      : (payment.refunds ?? [])
          .filter(refund => refund.status === 'SUCCEEDED')
          .reduce((sum, refund) => sum + refund.amountCents / 100, 0);

  return Math.max(payment.amount - refundedAmount, 0);
};

const getPaymentReportYear = (payment: Payment): number =>
  payment.registration?.year ?? new Date(payment.createdAt).getFullYear();

const canSubmitRefund = (payment: Payment): boolean =>
  getRefundableAmount(payment) > 0 && payment.provider !== 'PAYPAL';

/**
 * Payment administration page.
 * Supports externally recorded payments and full or partial refunds.
 */
export function AdminPaymentsPage() {
  const { config } = useConfig();
  const [searchParams] = useSearchParams();
  const initialYear = searchParams.get('year');
  const parsedInitialYear = initialYear ? parseInt(initialYear, 10) : undefined;
  const initialRegistrationId = searchParams.get('registrationId') || '';
  const initialUserId = searchParams.get('userId') || '';
  const initialFilters: PaymentReportFilters = {
    registrationId: initialRegistrationId || undefined,
    year: parsedInitialYear && !Number.isNaN(parsedInitialYear) ? parsedInitialYear : undefined,
  };
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PaymentReportFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showExternalPaymentForm, setShowExternalPaymentForm] = useState(false);
  const [externalPaymentRegistrations, setExternalPaymentRegistrations] = useState<
    ExternalPaymentRegistration[]
  >([]);
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);
  const [externalPaymentForm, setExternalPaymentForm] = useState<ExternalPaymentFormState>({
    ...emptyExternalPaymentForm,
    userId: initialUserId,
    registrationId: initialRegistrationId,
  });
  const [refundForm, setRefundForm] = useState<RefundFormState | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const hasLoadedPaymentsRef = useRef(false);
  const externalPaymentRegistrationYear =
    initialFilters.year ?? config?.currentYear ?? new Date().getFullYear();

  // Fetch payments data
  const fetchPayments = useCallback(async () => {
    if (!hasLoadedPaymentsRef.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await reports.getPayments(filters);
      // Ensure data is an array before setting it
      if (Array.isArray(data)) {
        setPayments(data);
        hasLoadedPaymentsRef.current = true;
      } else {
        console.error('Payments data is not an array:', data);
        setPayments([]);
        setError('Received invalid payment data format');
      }
    } catch (err) {
      setError('Failed to fetch payments data');
      console.error('Error fetching payments:', err);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (!showExternalPaymentForm) {
      return;
    }

    let isCurrent = true;
    setRegistrationsLoading(true);
    setRegistrationsError(null);

    adminRegistrationsApi
      .getRegistrations({
        year: externalPaymentRegistrationYear,
        limit: 100,
      })
      .then(response => {
        if (isCurrent) {
          setExternalPaymentRegistrations(response.registrations);
        }
      })
      .catch((err: unknown) => {
        if (isCurrent) {
          console.error('Error fetching registrations for external payment:', err);
          setExternalPaymentRegistrations([]);
          setRegistrationsError('Failed to load registrations');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setRegistrationsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [externalPaymentRegistrationYear, showExternalPaymentForm]);

  const selectedExternalPaymentRegistration = useMemo(
    () =>
      externalPaymentRegistrations.find(
        registration =>
          registration.id === externalPaymentForm.registrationId &&
          registration.user.id === externalPaymentForm.userId
      ),
    [externalPaymentForm.registrationId, externalPaymentForm.userId, externalPaymentRegistrations]
  );

  const matchingExternalPaymentRegistrations = useMemo(() => {
    const normalizedSearch = registrationSearch.trim().toLocaleLowerCase();

    return externalPaymentRegistrations
      .filter(registration => {
        if (!normalizedSearch) {
          return true;
        }

        const userSearchText = [
          registration.user.firstName,
          registration.user.lastName,
          registration.user.playaName,
          registration.user.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();

        return userSearchText.includes(normalizedSearch);
      })
      .slice(0, 8);
  }, [externalPaymentRegistrations, registrationSearch]);

  // Get unique years for filter dropdown
  const availableYears = useMemo(() => {
    // Extract years from payment registration context, falling back to payment date
    if (!Array.isArray(payments) || payments.length === 0) {
      return []; // Return empty array if no payments data
    }

    // Extract unique years from payment data
    const years = [...new Set(payments.map(getPaymentReportYear))];

    return years.sort((a, b) => b - a); // Sort descending
  }, [payments]);

  // Apply client-side filtering
  const filteredPayments = useMemo(() => {
    if (!Array.isArray(payments)) return [];

    return payments.filter(payment => {
      // Year filter
      if (filters.year) {
        const paymentYear = getPaymentReportYear(payment);
        if (paymentYear !== filters.year) return false;
      }

      // Status filter
      if (filters.status && payment.status !== filters.status) {
        return false;
      }

      // Provider filter
      if (filters.provider && payment.provider !== filters.provider) {
        return false;
      }

      return true;
    });
  }, [payments, filters]);

  // Calculate summary statistics based on filtered data
  const summaryStats = useMemo(() => {
    // Make sure filteredPayments is an array
    if (!Array.isArray(filteredPayments)) {
      return {
        total: 0,
        completed: 0,
        pending: 0,
        failed: 0,
        refunded: 0,
        partiallyRefunded: 0,
        totalAmount: 0,
      };
    }

    const total = filteredPayments.length;
    const completed = filteredPayments.filter(payment => payment.status === 'COMPLETED').length;
    const pending = filteredPayments.filter(payment => payment.status === 'PENDING').length;
    const failed = filteredPayments.filter(payment => payment.status === 'FAILED').length;
    const refunded = filteredPayments.filter(payment => payment.status === 'REFUNDED').length;
    const partiallyRefunded = filteredPayments.filter(
      payment => payment.status === 'PARTIALLY_REFUNDED'
    ).length;
    const totalAmount = filteredPayments
      .filter(payment => payment.status === 'COMPLETED' || payment.status === 'PARTIALLY_REFUNDED')
      .reduce((sum, payment) => sum + (payment.netAmount ?? payment.amount), 0);

    return { total, completed, pending, failed, refunded, partiallyRefunded, totalAmount };
  }, [filteredPayments]);

  const handleRecordExternalPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!externalPaymentForm.userId || !externalPaymentForm.registrationId) {
      setMutationError('Select a registration before recording payment');
      return;
    }

    setSubmitting(true);
    setMutationError(null);

    try {
      await reports.recordExternalPayment({
        amount: parseFloat(externalPaymentForm.amount),
        currency: 'USD',
        userId: externalPaymentForm.userId,
        registrationId: externalPaymentForm.registrationId || undefined,
        externalPaymentMethod: externalPaymentForm.externalPaymentMethod || undefined,
        reference: externalPaymentForm.reference || undefined,
        status: 'COMPLETED',
      });
      setExternalPaymentForm(emptyExternalPaymentForm);
      setRegistrationSearch('');
      setShowExternalPaymentForm(false);
      await fetchPayments();
    } catch (err) {
      setMutationError('Failed to record external payment');
      console.error('Error recording external payment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openRefundForm = (payment: Payment) => {
    if (!canSubmitRefund(payment)) {
      return;
    }

    setMutationError(null);
    setRefundForm({
      payment,
      amount: '',
      reason: '',
      resultingRegistrationStatus: '',
    });
  };

  const handleProcessRefund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!refundForm) {
      return;
    }

    setSubmitting(true);
    setMutationError(null);

    try {
      const refundResult = await reports.processRefund({
        paymentId: refundForm.payment.id,
        amount: parseFloat(refundForm.amount),
        reason: refundForm.reason || undefined,
        resultingRegistrationStatus: refundForm.resultingRegistrationStatus || undefined,
      });
      if (!refundResult.success && refundResult.refundStatus !== 'PENDING') {
        throw new Error(`Refund failed with status ${refundResult.refundStatus}`);
      }
      setRefundForm(null);
      await fetchPayments();
    } catch (err) {
      setMutationError('Failed to process refund');
      console.error('Error processing refund:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Define table columns
  const columns: DataTableColumn<Payment>[] = [
    {
      id: 'userName',
      header: 'Name',
      accessor: row => (row.user ? `${row.user.firstName} ${row.user.lastName}` : 'Unknown'),
      sortable: true,
      width: '20%',
    },
    {
      id: 'createdAt',
      header: 'Date/Time',
      accessor: row => {
        const date = new Date(row.createdAt);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      },
      sortable: true,
      width: '18%',
    },
    {
      id: 'amount',
      header: 'Amounts',
      accessor: row => row.netAmount ?? row.amount,
      Cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900">
            {formatCurrency(row.amount)} {row.currency}
          </div>
          <div className="text-xs text-gray-500">Refunded {formatCurrency(row.refundedAmount)}</div>
          <div className="text-xs text-gray-500">
            Net {formatCurrency(row.netAmount ?? row.amount)}
          </div>
        </div>
      ),
      sortable: true,
      width: '14%',
    },
    {
      id: 'status',
      header: 'Status',
      accessor: row => row.status,
      Cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.status === 'COMPLETED'
              ? 'bg-green-100 text-green-800'
              : row.status === 'PARTIALLY_REFUNDED'
                ? 'bg-amber-100 text-amber-800'
                : row.status === 'PENDING'
                  ? 'bg-yellow-100 text-yellow-800'
                  : row.status === 'FAILED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
          }`}
        >
          {row.status.replace(/_/g, ' ')}
        </span>
      ),
      sortable: true,
      width: '12%',
    },
    {
      id: 'provider',
      header: 'Source',
      accessor: row => (row.provider === 'MANUAL' ? 'External' : row.provider),
      Cell: ({ row }) => (
        <span>
          {row.provider === 'STRIPE' ? 'Stripe' : row.provider === 'PAYPAL' ? 'PayPal' : 'External'}
        </span>
      ),
      sortable: true,
      width: '10%',
    },
    {
      id: 'externalDetails',
      header: 'External Details',
      accessor: row =>
        [row.externalPaymentMethod, row.externalPaymentReference].filter(Boolean).join(' ') ||
        row.providerRefId ||
        'N/A',
      Cell: ({ row }) => (
        <div>
          <div>{row.externalPaymentMethod || row.providerRefId || 'N/A'}</div>
          {row.externalPaymentReference && (
            <div className="text-xs text-gray-500">{row.externalPaymentReference}</div>
          )}
        </div>
      ),
      sortable: true,
      hideOnMobile: true,
      width: '18%',
    },
    {
      id: 'refundableAmount',
      header: 'Refundable',
      accessor: row => getRefundableAmount(row),
      Cell: ({ row }) => formatCurrency(getRefundableAmount(row)),
      sortable: true,
      width: '10%',
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: () => '',
      Cell: ({ row }) => {
        const refundDisabled = !canSubmitRefund(row) || submitting;
        return (
          <button
            type="button"
            onClick={() => openRefundForm(row)}
            disabled={refundDisabled}
            title={
              row.provider === 'PAYPAL'
                ? 'PayPal refunds must be handled outside PlayaPlan'
                : undefined
            }
            className="rounded-md border border-amber-700 px-3 py-1 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
          >
            Refund
          </button>
        );
      },
      width: '10%',
    },
  ];

  const handleFilterChange = (key: keyof PaymentReportFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : key === 'year' ? parseInt(value) : value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const exportData = () => {
    // Convert payments data to CSV format
    const headers = [
      'Name',
      'Date/Time',
      'Amount',
      'Refunded',
      'Net Amount',
      'Refundable',
      'Status',
      'Source',
      'External Method',
      'External Reference',
      'Registration ID',
    ];

    const csvData = filteredPayments.map(payment => {
      const date = new Date(payment.createdAt);
      const dateTime = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      return [
        payment.user ? `${payment.user.firstName} ${payment.user.lastName}` : 'Unknown',
        dateTime,
        formatCurrency(payment.amount),
        formatCurrency(payment.refundedAmount),
        formatCurrency(payment.netAmount ?? payment.amount),
        formatCurrency(getRefundableAmount(payment)),
        payment.status,
        payment.provider === 'MANUAL' ? 'External' : payment.provider,
        payment.externalPaymentMethod || 'N/A',
        payment.externalPaymentReference || payment.providerRefId || 'N/A',
        payment.registrationId || 'N/A',
      ];
    });

    // Generate filename with current date and applied filters
    const filterSuffix = Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}-${value}`)
      .join('_');

    const filename = `payment_reports${filterSuffix ? '_' + filterSuffix : ''}_${new Date().toISOString().split('T')[0]}.csv`;

    downloadCsv(headers, csvData, { filename });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link
              to={PATHS.ADMIN}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Payment Administration</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Admin Only
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => {
                setMutationError(null);
                setShowExternalPaymentForm(isShowing => !isShowing);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-700 hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
            >
              Record External Payment
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              aria-label="Toggle filters"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </button>
            <button
              onClick={exportData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              aria-label="Export payments data"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">{summaryStats.total}</div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Total Payments</div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">{summaryStats.completed}</div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Completed</div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">{summaryStats.pending}</div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Pending</div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">{summaryStats.failed}</div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Failed</div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">
                    {summaryStats.refunded}
                    <span className="ml-1 text-sm text-gray-500">
                      / {summaryStats.partiallyRefunded}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Refunded / Partial</div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">
                    ${summaryStats.totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Net Revenue</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-gray-50 px-4 py-3 mb-6 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                <X className="mr-1 h-4 w-4" />
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="year-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Year
                </label>
                <select
                  id="year-filter"
                  value={filters.year || ''}
                  onChange={e => handleFilterChange('year', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="status-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status
                </label>
                <select
                  id="status-filter"
                  value={filters.status || ''}
                  onChange={e => handleFilterChange('status', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="provider-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Provider
                </label>
                <select
                  id="provider-filter"
                  value={filters.provider || ''}
                  onChange={e => handleFilterChange('provider', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">All Sources</option>
                  <option value="STRIPE">Stripe</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="MANUAL">External</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {mutationError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="text-sm text-red-700">{mutationError}</div>
          </div>
        )}

        {showExternalPaymentForm && (
          <form
            onSubmit={handleRecordExternalPayment}
            className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4"
          >
            <h2 className="mb-4 text-lg font-medium text-gray-900">Record external payment</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <label
                  htmlFor="external-payment-registration-search"
                  className="block text-sm font-medium text-gray-700"
                >
                  Registration
                </label>
                <p className="mt-1 text-xs text-gray-600">
                  Search {externalPaymentRegistrationYear} registrations by name, playa name, or
                  email.
                </p>
                {selectedExternalPaymentRegistration ? (
                  <div className="mt-2 flex items-center justify-between gap-4 rounded-md border border-amber-300 bg-white p-3">
                    <div>
                      <div className="font-medium text-gray-900">
                        {selectedExternalPaymentRegistration.user.firstName}{' '}
                        {selectedExternalPaymentRegistration.user.lastName}
                        {selectedExternalPaymentRegistration.user.playaName
                          ? ` (${selectedExternalPaymentRegistration.user.playaName})`
                          : ''}
                      </div>
                      <div className="text-sm text-gray-600">
                        {selectedExternalPaymentRegistration.user.email}
                        {' · '}
                        {selectedExternalPaymentRegistration.status.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setExternalPaymentForm(prev => ({
                          ...prev,
                          userId: '',
                          registrationId: '',
                        }));
                        setRegistrationSearch('');
                      }}
                      disabled={submitting}
                      className="text-sm font-medium text-amber-800 hover:text-amber-950 disabled:opacity-50"
                    >
                      Change registration
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      id="external-payment-registration-search"
                      type="search"
                      value={registrationSearch}
                      onChange={event => setRegistrationSearch(event.target.value)}
                      placeholder="Start typing a name or email"
                      disabled={registrationsLoading || submitting}
                      autoComplete="off"
                      className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 disabled:bg-gray-100 sm:text-sm"
                    />
                    {registrationsLoading ? (
                      <p className="mt-2 text-sm text-gray-600">Loading registrations...</p>
                    ) : registrationsError ? (
                      <p className="mt-2 text-sm text-red-700">{registrationsError}</p>
                    ) : (
                      <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white">
                        {matchingExternalPaymentRegistrations.length > 0 ? (
                          matchingExternalPaymentRegistrations.map(registration => (
                            <button
                              key={registration.id}
                              type="button"
                              onClick={() => {
                                setExternalPaymentForm(prev => ({
                                  ...prev,
                                  userId: registration.user.id,
                                  registrationId: registration.id,
                                }));
                                setRegistrationSearch('');
                              }}
                              className="block w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-amber-50 focus:bg-amber-50 focus:outline-none"
                            >
                              <span className="block font-medium text-gray-900">
                                {registration.user.firstName} {registration.user.lastName}
                                {registration.user.playaName
                                  ? ` (${registration.user.playaName})`
                                  : ''}
                              </span>
                              <span className="block text-sm text-gray-600">
                                {registration.user.email}
                                {' · '}
                                {registration.status.replace(/_/g, ' ')}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-4 text-sm text-gray-600">
                            No matching {externalPaymentRegistrationYear} registrations.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <label
                  htmlFor="external-payment-amount"
                  className="block text-sm font-medium text-gray-700"
                >
                  Amount
                </label>
                <input
                  id="external-payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={externalPaymentForm.amount}
                  onChange={event =>
                    setExternalPaymentForm(prev => ({ ...prev, amount: event.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="external-payment-method"
                  className="block text-sm font-medium text-gray-700"
                >
                  External method
                </label>
                <input
                  id="external-payment-method"
                  type="text"
                  placeholder="Stripe terminal, PayPal invoice, check, cash"
                  value={externalPaymentForm.externalPaymentMethod}
                  onChange={event =>
                    setExternalPaymentForm(prev => ({
                      ...prev,
                      externalPaymentMethod: event.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor="external-payment-reference"
                  className="block text-sm font-medium text-gray-700"
                >
                  Reference
                </label>
                <input
                  id="external-payment-reference"
                  type="text"
                  placeholder="Check #1234, PayPal invoice ID, terminal receipt"
                  value={externalPaymentForm.reference}
                  onChange={event =>
                    setExternalPaymentForm(prev => ({ ...prev, reference: event.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExternalPaymentForm(false)}
                disabled={submitting}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  submitting || !externalPaymentForm.userId || !externalPaymentForm.registrationId
                }
                className="rounded-md border border-transparent bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {submitting ? 'Recording...' : 'Record payment'}
              </button>
            </div>
          </form>
        )}

        {refundForm && (
          <form
            onSubmit={handleProcessRefund}
            className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Refund payment</h2>
                {refundForm.payment.provider === 'STRIPE' &&
                refundForm.payment.processorRefundAvailable ? (
                  <p className="text-sm text-gray-600">
                    This refund will be processed through Stripe.
                  </p>
                ) : (
                  <div
                    role="alert"
                    className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                  >
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <div className="font-semibold">Manual refund only</div>
                      <div>This refund will be recorded as a manual/offline refund.</div>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRefundForm(null)}
                disabled={submitting}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                aria-label="Close refund form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
              <div>Gross: {formatCurrency(refundForm.payment.amount)}</div>
              <div>Already refunded: {formatCurrency(refundForm.payment.refundedAmount)}</div>
              <div>
                Remaining refundable: {formatCurrency(getRefundableAmount(refundForm.payment))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="refund-amount" className="block text-sm font-medium text-gray-700">
                  Refund amount
                </label>
                <input
                  id="refund-amount"
                  type="number"
                  min="0.01"
                  max={getRefundableAmount(refundForm.payment)}
                  step="0.01"
                  required
                  value={refundForm.amount}
                  onChange={event =>
                    setRefundForm(prev => (prev ? { ...prev, amount: event.target.value } : prev))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="refund-registration-status"
                  className="block text-sm font-medium text-gray-700"
                >
                  Registration status change
                </label>
                <select
                  id="refund-registration-status"
                  value={refundForm.resultingRegistrationStatus}
                  onChange={event =>
                    setRefundForm(prev =>
                      prev
                        ? {
                            ...prev,
                            resultingRegistrationStatus: event.target.value as
                              | ''
                              | RegistrationStatus,
                          }
                        : prev
                    )
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">No status change</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="WAITLISTED">Waitlisted</option>
                  <option value="APPLICATION_SUBMITTED">Application submitted</option>
                  <option value="APPLICATION_APPROVED">Application approved</option>
                  <option value="APPLICATION_DECLINED">Application declined</option>
                </select>
              </div>
              <div>
                <label htmlFor="refund-reason" className="block text-sm font-medium text-gray-700">
                  Reason
                </label>
                <input
                  id="refund-reason"
                  type="text"
                  value={refundForm.reason}
                  onChange={event =>
                    setRefundForm(prev => (prev ? { ...prev, reason: event.target.value } : prev))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md border border-transparent bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit refund'}
              </button>
            </div>
          </form>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex items-center">
              <div className="text-sm text-red-700">{error}</div>
              <button
                onClick={fetchPayments}
                className="ml-auto inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Data Table */}
        {payments.length > 0 ? (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <DataTable
              data={filteredPayments}
              columns={columns}
              getRowKey={row => row.id}
              filterable={true}
              emptyMessage="No payments found"
            />
          </div>
        ) : !loading && !error ? (
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <p className="text-gray-500">No payments found</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
