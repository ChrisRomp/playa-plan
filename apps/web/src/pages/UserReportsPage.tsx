import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Download, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable, DataTableColumn } from '../components/common/DataTable/DataTable';
import { reports, User } from '../lib/api';
import { PATHS } from '../routes';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface UserReportFilters {
  year?: number;
  role?: string;
  status?: string;
}

/**
 * User Reports page
 * Displays all users in a filterable, sortable table for staff/admin
 */
export function UserReportsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserReportFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Fetch users data
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reports.getUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to fetch users data');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Apply client-side filtering
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Role filter
      if (filters.role && user.role !== filters.role) {
        return false;
      }
      
      // Status filter (email verification)
      if (filters.status) {
        if (filters.status === 'verified' && !user.isEmailVerified) {
          return false;
        }
        if (filters.status === 'unverified' && user.isEmailVerified) {
          return false;
        }
      }
      
      // Year filter would need user registration data - skip for now as users don't have year field
      
      return true;
    });
  }, [users, filters]);

  // Get unique years for filter dropdown (assuming users have a registration year)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      years.push(i);
    }
    return years.sort((a, b) => b - a);
  }, []);

  // Calculate summary statistics based on filtered data
  const summaryStats = useMemo(() => {
    const total = filteredUsers.length;
    const admins = filteredUsers.filter(user => user.role === 'ADMIN').length;
    const staff = filteredUsers.filter(user => user.role === 'STAFF').length;
    const participants = filteredUsers.filter(user => user.role === 'PARTICIPANT').length;
    const verified = filteredUsers.filter(user => user.isEmailVerified).length;
    
    return { total, admins, staff, participants, verified };
  }, [filteredUsers]);

  // Define table columns
  const columns: DataTableColumn<User>[] = [
    {
      id: 'name',
      header: 'Name',
      accessor: (row) => `${row.firstName} ${row.lastName}`,
      sortable: true,
    },
    {
      id: 'email',
      header: 'Email',
      accessor: (row) => row.email,
      sortable: true,
    },
    {
      id: 'role',
      header: 'Role',
      accessor: (row) => row.role,
      Cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.role === 'ADMIN'
              ? 'bg-purple-100 text-purple-800'
              : row.role === 'STAFF'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {row.role}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'isEmailVerified',
      header: 'Email Verified',
      accessor: (row) => row.isEmailVerified ? 'Verified' : 'Unverified',
      Cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.isEmailVerified
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {row.isEmailVerified ? 'Verified' : 'Unverified'}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'createdAt',
      header: 'Joined',
      accessor: (row) => new Date(row.createdAt).toLocaleDateString(),
      sortable: true,
      hideOnMobile: true,
    },
  ];

  const handleFilterChange = (key: keyof UserReportFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : key === 'year' ? parseInt(value) : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const exportData = () => {
    // Convert users data to CSV format
    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Role',
      'Email Verified',
      'Joined Date'
    ];

    const csvData = filteredUsers.map(user => [
      user.firstName,
      user.lastName,
      user.email,
      user.role,
      user.isEmailVerified ? 'Verified' : 'Unverified',
      new Date(user.createdAt).toLocaleDateString()
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
    
    const filename = `user_reports${filterSuffix ? '_' + filterSuffix : ''}_${new Date().toISOString().split('T')[0]}.csv`;
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
            <h1 className="text-3xl font-bold text-gray-900">User Reports</h1>
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
              aria-label="Export users data"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">{summaryStats.total}</div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Total Users</div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">{summaryStats.participants}</div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Participants</div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">{summaryStats.staff}</div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Staff</div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">{summaryStats.admins}</div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Admins</div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-lg font-medium text-gray-900">{summaryStats.verified}</div>
                </div>
              </div>
              <div className="mt-1">
                <div className="text-sm text-gray-500">Verified</div>
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
                <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  id="role-filter"
                  value={filters.role || ''}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="STAFF">Staff</option>
                  <option value="PARTICIPANT">Participant</option>
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
                  <option value="verified">Email Verified</option>
                  <option value="unverified">Email Unverified</option>
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
                onClick={fetchUsers}
                className="ml-auto inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Data Table */}
        {users.length > 0 ? (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <DataTable
              data={filteredUsers}
              columns={columns}
              getRowKey={(row) => row.id}
              filterable={true}
              emptyMessage="No users found"
            />
          </div>
        ) : !loading && !error ? (
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <p className="text-gray-500">No users found</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
