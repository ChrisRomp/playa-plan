import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Download, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable, DataTableColumn } from '../components/common/DataTable/DataTable';
import { reports } from '../lib/api';
import { Payment } from '../types';
import { PATHS } from '../routes';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface PaymentReportFilters {
  year?: number;
  status?: string;
  provider?: string;
}

/**
 * Payment Reports page - Admin only
 * Displays all payments in a filterable, sortable table for admin users
 */
export function PaymentReportsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PaymentReportFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Fetch payments data
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reports.getPayments();
      // Ensure data is an array before setting it
      if (Array.isArray(data)) {
        setPayments(data);
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
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Get unique years for filter dropdown
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      years.push(i);
    }
    return years.sort((a, b) => b - a);
  }, []);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    // Make sure payments is an array
    if (!Array.isArray(payments)) {
      return {
        total: 0,
        completed: 0,
        pending: 0,
        failed: 0,
        refunded: 0,
        totalAmount: 0
      };
    }
    
    const total = payments.length;
    const completed = payments.filter(payment => payment.status === 'COMPLETED').length;
    const pending = payments.filter(payment => payment.status === 'PENDING').length;
    const failed = payments.filter(payment => payment.status === 'FAILED').length;
    const refunded = payments.filter(payment => payment.status === 'REFUNDED').length;
    const totalAmount = payments
      .filter(payment => payment.status === 'COMPLETED')
      .reduce((sum, payment) => sum + payment.amount, 0);
    
    return { total, completed, pending, failed, refunded, totalAmount };
  }, [payments]);

  // Define table columns
  const columns: DataTableColumn<Payment>[] = [
    {
      id: 'id',
      header: 'Payment ID',
      accessor: (row) => row.id,
      sortable: true,
      hideOnMobile: true,
    },
    {
      id: 'amount',
      header: 'Amount',
      accessor: (row) => `$${(row.amount / 100).toFixed(2)}`,
      sortable: true,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (row) => row.status,
      Cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.status === 'COMPLETED'
              ? 'bg-green-100 text-green-800'
              : row.status === 'PENDING'
              ? 'bg-yellow-100 text-yellow-800'
              : row.status === 'FAILED'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {row.status}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'provider',
      header: 'Provider',
      accessor: (row) => row.provider,
      sortable: true,
    },
    {
      id: 'providerRefId',
      header: 'Reference ID',
      accessor: (row) => row.providerRefId || 'N/A',
      sortable: true,
      hideOnMobile: true,
    },
    {
      id: 'createdAt',
      header: 'Date',
      accessor: (row) => new Date(row.createdAt).toLocaleDateString(),
      sortable: true,
    },
  ];

  const handleFilterChange = (key: keyof PaymentReportFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : key === 'year' ? parseInt(value) : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const exportData = () => {
    // Convert payments data to CSV format
    const headers = [
      'Payment ID',
      'Amount',
      'Status',
      'Provider',
      'Reference ID',
      'User ID',
      'Registration ID',
      'Date'
    ];

    const csvData = payments.map(payment => [
      payment.id,
      `$${(payment.amount / 100).toFixed(2)}`,
      payment.status,
      payment.provider,
      payment.providerRefId || 'N/A',
      payment.userId,
      payment.registrationId || 'N/A',
      new Date(payment.createdAt).toLocaleDateString()
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => 
        // Escape fields that contain commas or quotes
        typeof field === 'string' && (field.includes(',') || field.includes('"')) 
          ? `"${field.replace(/"/g, '""')}"` 
          : field
      ).join(','))
    ].join('\\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename with current date and applied filters
    const filterSuffix = Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}-${value}`)
      .join('_');
    
    const filename = `payment_reports${filterSuffix ? '_' + filterSuffix : ''}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
              to={PATHS.REPORTS}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Reports
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Payment Reports</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Admin Only
            </span>
          </div>
          <div className="flex space-x-2">
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
                  <div className="text-lg font-medium text-gray-900">{summaryStats.refunded}</div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Refunded</div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">
                    ${(summaryStats.totalAmount / 100).toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Total Revenue</div>
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
                <label htmlFor="year-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  id="year-filter"
                  value={filters.year || ''}
                  onChange={(e) => handleFilterChange('year', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status-filter"
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
              </div>
              <div>
                <label htmlFor="provider-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Provider
                </label>
                <select
                  id="provider-filter"
                  value={filters.provider || ''}
                  onChange={(e) => handleFilterChange('provider', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">All Providers</option>
                  <option value="STRIPE">Stripe</option>
                  <option value="PAYPAL">PayPal</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex items-center">
              <div className="text-sm text-red-700">
                {error}
              </div>
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
              data={payments}
              columns={columns}
              getRowKey={(row) => row.id}
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
