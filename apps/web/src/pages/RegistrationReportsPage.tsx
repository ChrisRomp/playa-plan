import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Download, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable, DataTableColumn } from '../components/common/DataTable/DataTable';
import { reports, Registration, RegistrationReportFilters, CampingOptionRegistrationWithFields } from '../lib/api';
import { PATHS } from '../routes';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

/**
 * Registration Reports page
 * Displays all registrations in a filterable, sortable table for staff/admin
 */
export function RegistrationReportsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RegistrationReportFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showCampingOptions, setShowCampingOptions] = useState(() => {
    // Restore from localStorage
    return localStorage.getItem('registrationReports_showCampingOptions') === 'true';
  });
  const [campingOptionData, setCampingOptionData] = useState<CampingOptionRegistrationWithFields[]>([]);
  const [campingOptionsLoading, setCampingOptionsLoading] = useState(false);

  // Fetch registrations data
  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reports.getRegistrations({ 
        includeCampingOptions: showCampingOptions 
      });
      setRegistrations(data);
    } catch (err) {
      setError('Failed to fetch registrations data');
      console.error('Error fetching registrations:', err);
    } finally {
      setLoading(false);
    }
  }, [showCampingOptions]);

  // Fetch camping option registrations with field values
  const fetchCampingOptionData = useCallback(async () => {
    if (!showCampingOptions) {
      setCampingOptionData([]);
      return;
    }

    setCampingOptionsLoading(true);
    try {
      // Convert RegistrationReportFilters to CampingOptionReportFilters
      // by filtering out parameters not supported by the camping options endpoint
      const campingFilters = {
        year: filters.year,
        userId: filters.userId,
        // Note: jobId and includeCampingOptions are not supported by camping options endpoint
      };
      const data = await reports.getCampingOptionRegistrations(campingFilters);
      setCampingOptionData(data);
    } catch (err) {
      console.error('Error fetching camping option data:', err);
      // Don't set main error state for camping options - fail gracefully
    } finally {
      setCampingOptionsLoading(false);
    }
  }, [showCampingOptions, filters]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  useEffect(() => {
    fetchCampingOptionData();
  }, [fetchCampingOptionData]);

  // Save toggle state to localStorage
  useEffect(() => {
    localStorage.setItem('registrationReports_showCampingOptions', showCampingOptions.toString());
  }, [showCampingOptions]);

  // Apply client-side filtering
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(registration => {
      // Year filter
      if (filters.year && registration.year !== filters.year) {
        return false;
      }
      
      // Status filter
      if (filters.status && registration.status !== filters.status) {
        return false;
      }
      
      // User ID filter (for future use)
      if (filters.userId && registration.user?.id !== filters.userId) {
        return false;
      }
      
      // Job ID filter (for future use)
      if (filters.jobId && !registration.jobs.some(job => job.job.id === filters.jobId)) {
        return false;
      }
      
      return true;
    });
  }, [registrations, filters]);

  // Get unique years for filter dropdown
  const availableYears = useMemo(() => {
    const years = [...new Set(registrations.map(reg => reg.year))].sort((a, b) => b - a);
    return years;
  }, [registrations]);

  // Helper function to format camping option data for a user
  const formatCampingOptionData = useCallback((registration: Registration) => {
    if (!showCampingOptions || !registration.campingOptions || registration.campingOptions.length === 0) {
      return 'No camping options';
    }

    return registration.campingOptions.map(co => {
      // Find matching detailed data
      const detailData = campingOptionData.find(detail => 
        detail.userId === registration.userId && detail.campingOptionId === co.campingOptionId
      );

      let result = co.campingOption?.name || 'Unknown Option';
      
      if (detailData && detailData.fieldValues.length > 0) {
        const fieldData = detailData.fieldValues
          .map(fv => `${fv.field.displayName}: ${fv.value}`)
          .join(', ');
        result += ` (${fieldData})`;
      }
      
      return result;
    }).join('; ');
  }, [showCampingOptions, campingOptionData]);

  // Define table columns
  const columns: DataTableColumn<Registration>[] = useMemo(() => {
    const baseColumns: DataTableColumn<Registration>[] = [
    {
      id: 'user',
      header: 'User',
      accessor: (row) => row.user ? `${row.user.firstName} ${row.user.lastName}` : 'Unknown User',
      sortable: true,
    },
    {
      id: 'email',
      header: 'Email',
      accessor: (row) => row.user?.email || 'No email',
      sortable: true,
      hideOnMobile: true,
    },
    {
      id: 'year',
      header: 'Year',
      accessor: (row) => row.year,
      sortable: true,
    },
    {
      id: 'shift',
      header: 'Shift',
      accessor: (row) => {
        if (row.jobs.length === 0) return 'No shifts assigned';
        return row.jobs.map(j => j.job.name).join(', ');
      },
      sortable: true,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (row) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            row.status === 'CONFIRMED'
              ? 'bg-green-100 text-green-800'
              : row.status === 'PENDING'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {row.status}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'createdAt',
      header: 'Registered',
      accessor: (row) => new Date(row.createdAt).toLocaleDateString(),
      sortable: true,
      hideOnMobile: true,
    },
  ];

    // Add camping options column if enabled
    if (showCampingOptions) {
      // Insert camping options column before status
      const statusIndex = baseColumns.findIndex(col => col.id === 'status');
      baseColumns.splice(statusIndex, 0, {
        id: 'campingOptions',
        header: 'Registration Fields',
        accessor: (row) => (
          <div className="max-w-xs">
            <span className="text-sm">{formatCampingOptionData(row)}</span>
            {campingOptionsLoading && (
              <span className="ml-2 text-xs text-gray-500">(loading...)</span>
            )}
          </div>
        ),
        sortable: false,
        hideOnMobile: true,
      });
    }

    return baseColumns;
  }, [showCampingOptions, formatCampingOptionData, campingOptionsLoading]);

  const handleFilterChange = (key: keyof RegistrationReportFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : key === 'year' ? parseInt(value) : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setShowCampingOptions(false);
  };

  const exportData = () => {
    // Convert registrations data to CSV format
    const baseHeaders = [
      'User Name',
      'Email',
      'Shift',
      'Status',
      'Year',
      'Registered Date'
    ];

    // Add camping options header if enabled
    const headers = showCampingOptions 
      ? [...baseHeaders.slice(0, 3), 'Registration Fields', ...baseHeaders.slice(3)]
      : baseHeaders;

    const csvData = filteredRegistrations.map(registration => {
      const baseData = [
        registration.user ? `${registration.user.firstName} ${registration.user.lastName}` : 'Unknown User',
        registration.user?.email || '',
        registration.jobs.map(rj => rj.job.name).join('; ') || '',
        registration.status,
        registration.year.toString(),
        new Date(registration.createdAt).toLocaleDateString()
      ];

      // Add camping options data if enabled
      if (showCampingOptions) {
        const campingOptionText = formatCampingOptionData(registration);
        return [
          ...baseData.slice(0, 2), // User Name, Email
          campingOptionText, // Registration Fields
          ...baseData.slice(2) // Shift, Status, Year, Registered Date
        ];
      }

      return baseData;
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => 
        // Escape fields that contain commas or quotes
        typeof field === 'string' && (field.includes(',') || field.includes('"')) 
          ? `"${field.replace(/"/g, '""')}"` 
          : field
      ).join(','))
    ].join('\n');

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
    
    const campingSuffix = showCampingOptions ? '_with_registration_fields' : '';
    const filename = `registration_reports${filterSuffix ? '_' + filterSuffix : ''}${campingSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
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
              className="inline-flex items-center text-amber-600 hover:text-amber-700"
            >
              <ArrowLeft size={20} className="mr-1" />
              Back to Reports
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Registration Reports</h1>
              <p className="text-gray-600">View and analyze camp registrations</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter size={16} className="mr-2" />
              Filters
            </button>
            <button
              onClick={exportData}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700"
            >
              <Download size={16} className="mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="year-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Year
                  </label>
                  <select
                    id="year-filter"
                    value={filters.year || ''}
                    onChange={(e) => handleFilterChange('year', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="PENDING">Pending</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
              
              {/* Camping Options Toggle */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="camping-options-toggle" className="block text-sm font-medium text-gray-700">
                      Show Registration Fields
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Display camping option registrations and custom field values
                    </p>
                  </div>
                  <div className="flex items-center">
                    <button
                      type="button"
                      id="camping-options-toggle"
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                        showCampingOptions ? 'bg-amber-600' : 'bg-gray-200'
                      }`}
                      onClick={() => setShowCampingOptions(!showCampingOptions)}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showCampingOptions ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchRegistrations}
              className="mt-2 text-red-600 hover:text-red-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow">
          <DataTable
            data={filteredRegistrations}
            columns={columns}
            getRowKey={(row) => row.id}
            filterable={true}
            paginated={true}
            defaultPageSize={25}
            caption="Registration reports table"
            emptyMessage="No registrations found"
            initialSort={{ id: 'createdAt', direction: 'desc' }}
          />
        </div>

        {/* Summary */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Registrations:</span>
              <span className="ml-2">{filteredRegistrations.length}</span>
            </div>
            <div>
              <span className="font-medium">Confirmed:</span>
              <span className="ml-2 text-green-600">
                {filteredRegistrations.filter(r => r.status === 'CONFIRMED').length}
              </span>
            </div>
            <div>
              <span className="font-medium">Pending:</span>
              <span className="ml-2 text-yellow-600">
                {filteredRegistrations.filter(r => r.status === 'PENDING').length}
              </span>
            </div>
            <div>
              <span className="font-medium">Cancelled:</span>
              <span className="ml-2 text-red-600">
                {filteredRegistrations.filter(r => r.status === 'CANCELLED').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
