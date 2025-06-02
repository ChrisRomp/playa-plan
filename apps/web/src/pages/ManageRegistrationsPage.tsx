import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Filter, X, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import RegistrationSearchTable from '../components/admin/registrations/RegistrationSearchTable';

// TODO: Replace with actual API types when implemented
interface Registration {
  id: string;
  year: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    playaName?: string;
    role: string;
  };
  jobs: Array<{
    job: {
      id: string;
      name: string;
      category?: {
        name: string;
      };
      shift?: {
        name: string;
        startTime: string;
        endTime: string;
        dayOfWeek: string;
      };
    };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
  }>;
}

interface RegistrationFilters {
  year?: number;
  status?: string;
  email?: string;
  name?: string;
}

/**
 * Admin Registration Management page
 * Allows admins to view, edit, and cancel user registrations
 */
export function ManageRegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RegistrationFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Mock data for development - replace with actual API call
  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual API call to /admin/registrations
      // const data = await adminRegistrationsApi.getRegistrations(filters);
      
      // Mock data for development
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockData: Registration[] = [
        {
          id: '1',
          year: 2024,
          status: 'CONFIRMED',
          createdAt: '2024-01-15T10:00:00Z',
          user: {
            id: 'user1',
            email: 'john.doe@example.com',
            firstName: 'John',
            lastName: 'Doe',
            playaName: 'Sparkles',
            role: 'PARTICIPANT',
          },
          jobs: [
            {
              job: {
                id: 'job1',
                name: 'Kitchen Helper',
                category: { name: 'Kitchen' },
                shift: {
                  name: 'Morning Shift',
                  startTime: '08:00',
                  endTime: '12:00',
                  dayOfWeek: 'MONDAY',
                },
              },
            },
          ],
          payments: [
            {
              id: 'payment1',
              amount: 150.00,
              status: 'COMPLETED',
            },
          ],
        },
        // Add more mock data as needed
      ];
      
      setRegistrations(mockData);
    } catch (err) {
      setError('Failed to fetch registrations data');
      console.error('Error fetching registrations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Get summary statistics
  const stats = useMemo(() => {
    const total = registrations.length;
    const confirmed = registrations.filter(r => r.status === 'CONFIRMED').length;
    const pending = registrations.filter(r => r.status === 'PENDING').length;
    const cancelled = registrations.filter(r => r.status === 'CANCELLED').length;
    
    return { total, confirmed, pending, cancelled };
  }, [registrations]);

  // Get unique years for filter dropdown
  const availableYears = useMemo(() => {
    const years = [...new Set(registrations.map(reg => reg.year))].sort((a, b) => b - a);
    return years;
  }, [registrations]);

  const handleFilterChange = (key: keyof RegistrationFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : key === 'year' ? parseInt(value) : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const handleViewAuditTrail = (registrationId: string) => {
    // TODO: Implement audit trail modal or navigation
    console.log('View audit trail for registration:', registrationId);
  };

  const handleEditRegistration = (registrationId: string) => {
    // TODO: Implement edit registration modal or navigation
    console.log('Edit registration:', registrationId);
  };

  const handleCancelRegistration = (registrationId: string) => {
    // TODO: Implement cancel registration modal with confirmation
    console.log('Cancel registration:', registrationId);
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
              to={ROUTES.ADMIN.path}
              className="inline-flex items-center text-amber-600 hover:text-amber-700"
            >
              <ArrowLeft size={20} className="mr-1" />
              Back to Admin
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manage Registrations</h1>
              <p className="text-gray-600">View, edit, and manage user registrations</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                showFilters
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter size={16} className="mr-1" />
              Filters
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Users className="h-5 w-5 text-blue-500 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-600">Confirmed</p>
                <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <X className="h-5 w-5 text-red-500 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  value={filters.year || ''}
                  onChange={(e) => handleFilterChange('year', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">All years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="WAITLISTED">Waitlisted</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="text"
                  value={filters.email || ''}
                  onChange={(e) => handleFilterChange('email', e.target.value)}
                  placeholder="Search by email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={filters.name || ''}
                  onChange={(e) => handleFilterChange('name', e.target.value)}
                  placeholder="Search by name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <RegistrationSearchTable
          registrations={registrations}
          onEditRegistration={handleEditRegistration}
          onCancelRegistration={handleCancelRegistration}
          onViewAuditTrail={handleViewAuditTrail}
          emptyMessage="No registrations found"
        />
      </div>
    </div>
  );
}

export default ManageRegistrationsPage; 