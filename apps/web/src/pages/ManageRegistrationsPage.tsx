import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, Filter, X, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import RegistrationSearchTable from '../components/admin/registrations/RegistrationSearchTable';
import RegistrationEditForm from '../components/admin/registrations/RegistrationEditForm';
import RegistrationCancelForm from '../components/admin/registrations/RegistrationCancelForm';
import AuditTrailView from '../components/admin/registrations/AuditTrailView';
import { useRegistrationManagement } from '../hooks/useRegistrationManagement';
import { adminRegistrationsApi, PaginatedRegistrationsResponse, Job, CampingOption, UserCampingOptionRegistration } from '../lib/api/admin-registrations';

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
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [availableCampingOptions, setAvailableCampingOptions] = useState<CampingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RegistrationFilters>({});
  const [localFilters, setLocalFilters] = useState<RegistrationFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Registration management state and actions
  const {
    state: managementState,
    openEditModal,
    openCancelModal,
    openAuditTrailModal,
    closeAllModals,
    editRegistration,
    cancelRegistration,
    clearMessages,
  } = useRegistrationManagement();

  // Fetch available options for edit form
  const fetchAvailableOptions = useCallback(async () => {
    try {
      const [jobs, campingOptions] = await Promise.all([
        adminRegistrationsApi.getAvailableJobs(),
        adminRegistrationsApi.getAvailableCampingOptions(),
      ]);
      setAvailableJobs(jobs);
      setAvailableCampingOptions(campingOptions);
    } catch (err) {
      console.error('Error fetching available options:', err);
      // Continue with empty arrays if fetch fails
    }
  }, []);

  // Fetch registrations from API
  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: PaginatedRegistrationsResponse = await adminRegistrationsApi.getRegistrations(filters);
      console.log('API response:', data); // Debug log
      // Extract registrations array from the response object
      const registrationsArray = data?.registrations || [];
      setRegistrations(Array.isArray(registrationsArray) ? registrationsArray : []);
    } catch (err) {
      console.error('Error fetching registrations:', err);
      setError('Failed to fetch registrations data');
      setRegistrations([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounced effect to update filters
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setFilters(localFilters);
    }, 500); // 500ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localFilters]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Fetch available options on component mount
  useEffect(() => {
    fetchAvailableOptions();
  }, [fetchAvailableOptions]);

  // Get summary statistics
  const stats = useMemo(() => {
    // Ensure registrations is an array before filtering
    const regArray = Array.isArray(registrations) ? registrations : [];
    const total = regArray.length;
    const confirmed = regArray.filter(r => r.status === 'CONFIRMED').length;
    const pending = regArray.filter(r => r.status === 'PENDING').length;
    const cancelled = regArray.filter(r => r.status === 'CANCELLED').length;
    
    return { total, confirmed, pending, cancelled };
  }, [registrations]);

  // Get unique years for filter dropdown
  const availableYears = useMemo(() => {
    const regArray = Array.isArray(registrations) ? registrations : [];
    const years = [...new Set(regArray.map(reg => reg.year))].sort((a, b) => b - a);
    return years;
  }, [registrations]);

  const handleFilterChange = (key: keyof RegistrationFilters, value: string) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : key === 'year' ? parseInt(value) : value
    }));
  };

  const clearFilters = () => {
    setLocalFilters({});
    setFilters({});
  };

  // Convert API registration format to component format with camping options
  const convertRegistrationForComponent = (registration: Registration, userCampingOptions: UserCampingOptionRegistration[] = []) => {
    return {
      ...registration,
      jobs: registration.jobs.map((rj, index) => ({
        id: `registration-job-${index}`, // Generate ID since it's not in the API response
        job: rj.job
      })),
      // Convert user camping options to the format expected by the component
      campingOptions: userCampingOptions.map((ucor) => ({
        id: ucor.id,
        campingOption: ucor.campingOption
      }))
    };
  };

  const handleViewAuditTrail = (registrationId: string) => {
    const registration = registrations.find(r => r.id === registrationId);
    if (registration) {
      openAuditTrailModal(convertRegistrationForComponent(registration));
    }
  };

  const handleEditRegistration = async (registrationId: string) => {
    const registration = registrations.find(r => r.id === registrationId);
    if (registration) {
      try {
        // Fetch user's camping options for this registration
        const userCampingOptions = await adminRegistrationsApi.getUserCampingOptions(registrationId);
        openEditModal(convertRegistrationForComponent(registration, userCampingOptions));
      } catch (error) {
        console.error('Error fetching user camping options:', error);
        // Fallback to opening without camping options
        openEditModal(convertRegistrationForComponent(registration));
      }
    }
  };

  const handleCancelRegistration = (registrationId: string) => {
    const registration = registrations.find(r => r.id === registrationId);
    if (registration) {
      openCancelModal(convertRegistrationForComponent(registration));
    }
  };

  // Handle successful operations by refreshing data
  useEffect(() => {
    if (managementState.lastSuccessMessage) {
      fetchRegistrations(); // Refresh the list after successful operations
      
      // Clear success message after 5 seconds
      const timer = setTimeout(() => {
        clearMessages();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [managementState.lastSuccessMessage, fetchRegistrations, clearMessages]);

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
                  value={localFilters.year || ''}
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
                  value={localFilters.status || ''}
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
                  value={localFilters.email || ''}
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
                  value={localFilters.name || ''}
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

        {/* Success/Error Messages */}
        {managementState.lastSuccessMessage && (
          <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg z-50">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400 mr-2 flex-shrink-0" />
              <span>{managementState.lastSuccessMessage}</span>
            </div>
          </div>
        )}

        {managementState.lastErrorMessage && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
              <span>{managementState.lastErrorMessage}</span>
              <button
                onClick={clearMessages}
                className="ml-4 text-red-700 hover:text-red-900"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Modals */}
        {managementState.editModalOpen && managementState.selectedRegistration && (
          <RegistrationEditForm
            registration={managementState.selectedRegistration as unknown as Parameters<typeof RegistrationEditForm>[0]['registration']}
            availableJobs={availableJobs}
            availableCampingOptions={availableCampingOptions}
            loading={managementState.editLoading}
            onSubmit={editRegistration}
            onClose={closeAllModals}
          />
        )}

        {managementState.cancelModalOpen && managementState.selectedRegistration && (
          <RegistrationCancelForm
            registration={managementState.selectedRegistration as unknown as Parameters<typeof RegistrationCancelForm>[0]['registration']}
            loading={managementState.cancelLoading}
            onSubmit={cancelRegistration}
            onClose={closeAllModals}
          />
        )}

        {managementState.auditTrailModalOpen && managementState.selectedRegistration && (
          <AuditTrailView
            registrationId={managementState.selectedRegistration.id}
            onClose={closeAllModals}
          />
        )}
      </div>
    </div>
  );
}

export default ManageRegistrationsPage; 