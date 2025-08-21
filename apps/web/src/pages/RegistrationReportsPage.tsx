import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Download, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable, DataTableColumn } from '../components/common/DataTable/DataTable';
import { reports, Registration, RegistrationReportFilters, CampingOptionRegistrationWithFields } from '../lib/api';
import { PATHS } from '../routes';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { downloadCsv } from '../utils/csv';

// Extended user type for registration reports that includes profile fields
interface UserWithProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  playaName?: string;
  role?: string;
  phone?: string;
  city?: string;
  stateProvince?: string;
  country?: string;
  emergencyContact?: string;
}

// User profile field definitions for consistent ordering
const USER_PROFILE_FIELDS = [
  { key: 'playaName', label: 'Playa Name' },
  { key: 'role', label: 'Role' },
  { key: 'phone', label: 'Phone' },
  { key: 'emergencyContact', label: 'Emergency Contact' },
  { key: 'city', label: 'City' },
  { key: 'stateProvince', label: 'State/Province' },
  { key: 'country', label: 'Country' },
] as const;

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
  const [showUserProfile, setShowUserProfile] = useState(() => {
    // Restore from localStorage
    return localStorage.getItem('registrationReports_showUserProfile') === 'true';
  });
  const [campingOptionData, setCampingOptionData] = useState<CampingOptionRegistrationWithFields[]>([]);
  const [campingOptionsLoading, setCampingOptionsLoading] = useState(false);

  // Fetch registrations data
  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reports.getRegistrations({ 
        includeCampingOptions: showCampingOptions,
        includeUserProfile: showUserProfile
      });
      setRegistrations(data);
    } catch (err) {
      setError('Failed to fetch registrations data');
      console.error('Error fetching registrations:', err);
    } finally {
      setLoading(false);
    }
  }, [showCampingOptions, showUserProfile]);

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

  useEffect(() => {
    localStorage.setItem('registrationReports_showUserProfile', showUserProfile.toString());
  }, [showUserProfile]);

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

  // Get unique field display names from camping option data
  const uniqueFields = useMemo(() => {
    if (!showCampingOptions || campingOptionData.length === 0) {
      return [];
    }

    const fieldMap = new Map<string, { displayName: string; order: number }>();
    
    campingOptionData.forEach(registration => {
      registration.fieldValues.forEach(fieldValue => {
        const fieldId = fieldValue.field.id;
        if (!fieldMap.has(fieldId)) {
          // Try to obtain an explicit order from the field value first,
          // then fall back to the campingOption.fields definition if available.
          const orderFromField = (fieldValue.field as unknown as { order?: number }).order;
          const orderFromOption = registration.campingOption?.fields?.find(f => f.id === fieldId)?.order;
          const order = typeof orderFromField === 'number' ? orderFromField : (typeof orderFromOption === 'number' ? orderFromOption : 0);

          fieldMap.set(fieldId, {
            displayName: fieldValue.field.displayName,
            order,
          });
        }
      });
    });

    // Convert to array and sort by order
    return Array.from(fieldMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => {
        const orderA = Number(a.order);
        const orderB = Number(b.order);
        const safeA = isNaN(orderA) ? 0 : orderA;
        const safeB = isNaN(orderB) ? 0 : orderB;
        return safeA - safeB;
      });
  }, [showCampingOptions, campingOptionData]);

  // Helper function to get field value for a specific user and field
  const getFieldValue = useCallback((registration: Registration, fieldId: string) => {
    if (!showCampingOptions || !registration.campingOptions || registration.campingOptions.length === 0) {
      return '';
    }

    // Find matching detailed data for any of the user's camping options
    for (const co of registration.campingOptions) {
      const detailData = campingOptionData.find(detail => 
        detail.userId === registration.userId && detail.campingOptionId === co.campingOptionId
      );
      
      if (detailData) {
        const fieldValue = detailData.fieldValues.find(fv => fv.field.id === fieldId);
        if (fieldValue) {
          return fieldValue.value;
        }
      }
    }

    return '';
  }, [showCampingOptions, campingOptionData]);

  // Helper function to format camping option name(s) for a user
  const formatCampingOptionName = useCallback((registration: Registration) => {
    if (!showCampingOptions || !registration.campingOptions || registration.campingOptions.length === 0) {
      return 'No camping options';
    }

    return registration.campingOptions
      .map(co => co.campingOption?.name || 'Unknown Option')
      .join(', ');
  }, [showCampingOptions]);

  // Helper function to create user profile columns from field definitions
  const createUserProfileColumns = (): DataTableColumn<Registration>[] => {
    return USER_PROFILE_FIELDS.map(field => ({
      id: field.key,
      header: field.label,
      accessor: (row) => {
        const user = row.user as UserWithProfile | undefined;
        return (
          <div className="max-w-xs">
            <span className="text-sm">{user?.[field.key as keyof UserWithProfile] || '-'}</span>
          </div>
        );
      },
      sortable: true,
      hideOnMobile: true,
    }));
  };

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

    // Add user profile columns if enabled
    if (showUserProfile) {
      const emailIndex = baseColumns.findIndex(col => col.id === 'email');
      if (emailIndex === -1) {
        console.warn('Email column not found in base columns, user profile columns will be appended at the end');
      }
      const userProfileColumns = createUserProfileColumns();
      
      // Insert user profile columns after email (or at end if email not found)
      const insertIndex = emailIndex === -1 ? baseColumns.length : emailIndex + 1;
      userProfileColumns.forEach((column, index) => {
        baseColumns.splice(insertIndex + index, 0, column);
      });
    }

    // Add camping options columns if enabled
    if (showCampingOptions) {
      const statusIndex = baseColumns.findIndex(col => col.id === 'status');
      
      // Add camping option name column
      baseColumns.splice(statusIndex, 0, {
        id: 'campingOptionName',
        header: 'Camping Option',
        accessor: (row) => (
          <div className="max-w-xs">
            <span className="text-sm">{formatCampingOptionName(row)}</span>
            {campingOptionsLoading && (
              <span className="ml-2 text-xs text-gray-500">(loading...)</span>
            )}
          </div>
        ),
        sortable: true,
        hideOnMobile: true,
      });

      // Add dynamic columns for each unique field
      uniqueFields.forEach((field, index) => {
        baseColumns.splice(statusIndex + 1 + index, 0, {
          id: `field_${field.id}`,
          header: field.displayName,
          accessor: (row) => {
            const value = getFieldValue(row, field.id);
            return (
              <div className="max-w-xs">
                <span className="text-sm">{value || '-'}</span>
              </div>
            );
          },
          sortable: true,
          hideOnMobile: true,
        });
      });
    }

    return baseColumns;
  }, [showCampingOptions, showUserProfile, formatCampingOptionName, campingOptionsLoading, uniqueFields, getFieldValue]);

  const handleFilterChange = (key: keyof RegistrationReportFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : key === 'year' ? parseInt(value) : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
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

    // Add user profile headers if enabled
    let headers = baseHeaders;
    if (showUserProfile) {
      const emailIndex = baseHeaders.indexOf('Email');
      const userProfileHeaders = USER_PROFILE_FIELDS.map(field => field.label);
      headers = [
        ...baseHeaders.slice(0, emailIndex + 1), // User Name, Email
        ...userProfileHeaders, // User profile fields
        ...baseHeaders.slice(emailIndex + 1) // Shift, Status, Year, Registered Date
      ];
    }

    // Add camping options headers if enabled
    if (showCampingOptions) {
      const shiftIndex = headers.indexOf('Shift');
      const campingHeaders = ['Camping Option', ...uniqueFields.map(field => field.displayName)];
      headers = [
        ...headers.slice(0, shiftIndex),
        ...campingHeaders,
        ...headers.slice(shiftIndex)
      ];
    }

    const csvData = filteredRegistrations.map(registration => {
      const baseData = [
        registration.user ? `${registration.user.firstName} ${registration.user.lastName}` : 'Unknown User',
        registration.user?.email || '',
        registration.jobs.map(rj => rj.job.name).join('; ') || '',
        registration.status,
        registration.year.toString(),
        new Date(registration.createdAt).toLocaleDateString()
      ];

      let data = [...baseData];

      // Add user profile data if enabled
      if (showUserProfile) {
        const emailIndex = headers.indexOf('Email');
        if (emailIndex === -1) {
          console.warn('Email header not found in CSV headers, user profile data will be appended at the end');
        }
        const userProfileData = USER_PROFILE_FIELDS.map(field =>
          (registration.user as UserWithProfile)?.[field.key as keyof UserWithProfile] || ''
        );
        
        const insertIndex = emailIndex === -1 ? data.length : emailIndex + 1;
        data = [
          ...data.slice(0, insertIndex), // Up to and including Email
          ...userProfileData, // User profile fields
          ...data.slice(insertIndex) // Remaining fields
        ];
      }

      // Add camping options data if enabled
      if (showCampingOptions) {
        // Calculate shift position based on current data structure
        const EMAIL_INDEX = 1; // Position of Email in original baseData structure
        const afterUserProfileIndex = EMAIL_INDEX + 1 + USER_PROFILE_FIELDS.length;
        const shiftIndex = showUserProfile ? afterUserProfileIndex : 2;
        
        const campingOptionName = formatCampingOptionName(registration);
        const fieldValues = uniqueFields.map(field => getFieldValue(registration, field.id) || '');
        
        data = [
          ...data.slice(0, shiftIndex), // Everything before Shift
          campingOptionName, // Camping Option
          ...fieldValues, // Dynamic field values
          ...data.slice(shiftIndex) // Shift, Status, Year, Registered Date
        ];
      }

      return data;
    });

    // Generate filename with current date
    const filename = `registration_report_${new Date().toISOString().split('T')[0]}.csv`;
    
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
            </div>
          </div>
        )}

        {/* Display Options Toggles */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
          {/* Show User Profile Fields Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="user-profile-toggle" className="block text-sm font-medium text-gray-700">
                Show User Profile Fields
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Display additional user profile information (playa name, role, contact, location)
              </p>
            </div>
            <div className="flex items-center">
              <button
                type="button"
                id="user-profile-toggle"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                  showUserProfile ? 'bg-amber-600' : 'bg-gray-200'
                }`}
                onClick={() => setShowUserProfile(!showUserProfile)}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showUserProfile ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Show Registration Fields Toggle */}
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
