import { useState, useMemo } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from '../../common/LoadingSpinner';

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
    id: string;
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
  campingOptions: Array<{
    id: string;
    campingOption: {
      id: string;
      name: string;
      description?: string;
      pricePerPerson: number;
    };
  }>;
}

interface Job {
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
  description?: string;
}

interface CampingOption {
  id: string;
  name: string;
  description?: string;
  pricePerPerson: number;
  maxOccupancy?: number;
  currentOccupancy?: number;
}

interface RegistrationEditFormProps {
  /** The registration to edit */
  registration: Registration;
  /** Available jobs to choose from */
  availableJobs: Job[];
  /** Available camping options to choose from */
  availableCampingOptions: CampingOption[];
  /** Whether the form is currently submitting */
  loading?: boolean;
  /** Handler for form submission */
  onSubmit: (data: RegistrationEditData) => void;
  /** Handler for closing the form */
  onClose: () => void;
}

interface RegistrationEditData {
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
  jobIds: string[];
  campingOptionIds: string[];
  reason: string;
  sendNotification: boolean;
}

/**
 * Form component for editing user registrations
 * Allows admins to modify status, work shifts, and camping options
 */
export function RegistrationEditForm({
  registration,
  availableJobs,
  availableCampingOptions,
  loading = false,
  onSubmit,
  onClose,
}: RegistrationEditFormProps) {
  const [formData, setFormData] = useState<RegistrationEditData>({
    status: registration.status,
    jobIds: registration.jobs.map(j => j.job.id),
    campingOptionIds: registration.campingOptions?.map(co => co.campingOption.id) || [],
    reason: '',
    sendNotification: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if form has changes
  const hasChanges = useMemo(() => {
    const originalJobIds = registration.jobs.map(j => j.job.id).sort();
    const originalCampingOptionIds = registration.campingOptions?.map(co => co.campingOption.id).sort() || [];
    const currentJobIds = [...formData.jobIds].sort();
    const currentCampingOptionIds = [...formData.campingOptionIds].sort();

    return (
      formData.status !== registration.status ||
      JSON.stringify(originalJobIds) !== JSON.stringify(currentJobIds) ||
      JSON.stringify(originalCampingOptionIds) !== JSON.stringify(currentCampingOptionIds)
    );
  }, [formData, registration]);

  // Get currently selected jobs and camping options
  const selectedJobs = useMemo(() => {
    return availableJobs.filter(job => formData.jobIds.includes(job.id));
  }, [availableJobs, formData.jobIds]);

  const selectedCampingOptions = useMemo(() => {
    return availableCampingOptions.filter(option => formData.campingOptionIds.includes(option.id));
  }, [availableCampingOptions, formData.campingOptionIds]);

  const handleStatusChange = (status: RegistrationEditData['status']) => {
    setFormData(prev => ({ ...prev, status }));
    setErrors(prev => ({ ...prev, status: '' }));
  };

  const handleJobToggle = (jobId: string) => {
    setFormData(prev => ({
      ...prev,
      jobIds: prev.jobIds.includes(jobId)
        ? prev.jobIds.filter(id => id !== jobId)
        : [...prev.jobIds, jobId]
    }));
  };

  const handleCampingOptionToggle = (optionId: string) => {
    setFormData(prev => ({
      ...prev,
      campingOptionIds: prev.campingOptionIds.includes(optionId)
        ? prev.campingOptionIds.filter(id => id !== optionId)
        : [...prev.campingOptionIds, optionId]
    }));
  };

  const handleReasonChange = (reason: string) => {
    setFormData(prev => ({ ...prev, reason }));
    setErrors(prev => ({ ...prev, reason: '' }));
  };

  const handleNotificationToggle = (sendNotification: boolean) => {
    setFormData(prev => ({ ...prev, sendNotification }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!hasChanges) {
      newErrors.general = 'No changes have been made to the registration.';
    }

    if (hasChanges && !formData.reason.trim()) {
      newErrors.reason = 'Please provide a reason for the changes.';
    }

    if (formData.status === 'CANCELLED') {
      newErrors.status = 'Use the cancel registration function to cancel registrations.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  // Prevent editing cancelled registrations
  if (registration.status === 'CANCELLED') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Cannot Edit Registration</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle size={20} />
              <p>This registration has been cancelled and cannot be edited.</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] mx-4 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Edit Registration</h2>
              <p className="text-sm text-gray-600">
                {registration.user.firstName} {registration.user.lastName} ({registration.user.email})
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* General Errors */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{errors.general}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registration Status
              </label>
              <div className="space-y-2">
                {(['PENDING', 'CONFIRMED', 'WAITLISTED'] as const).map((status) => (
                  <label key={status} className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      value={status}
                      checked={formData.status === status}
                      onChange={() => handleStatusChange(status)}
                      className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">{status}</span>
                  </label>
                ))}
              </div>
              {errors.status && <p className="mt-1 text-sm text-red-600">{errors.status}</p>}
            </div>

            {/* Work Shifts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Shifts
              </label>
              <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                {availableJobs.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">No jobs available</p>
                ) : (
                  <div className="p-2">
                    {availableJobs.map((job) => (
                      <label key={job.id} className="flex items-start p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={formData.jobIds.includes(job.id)}
                          onChange={() => handleJobToggle(job.id)}
                          className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded mt-1"
                        />
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-gray-900">{job.name}</div>
                          {job.category && (
                            <div className="text-xs text-gray-500">{job.category.name}</div>
                          )}
                          {job.shift && (
                            <div className="text-xs text-gray-500">
                              {job.shift.dayOfWeek} {job.shift.startTime} - {job.shift.endTime}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedJobs.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">Selected shifts:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedJobs.map((job) => (
                      <span
                        key={job.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                      >
                        {job.name}
                        <button
                          type="button"
                          onClick={() => handleJobToggle(job.id)}
                          className="ml-1 h-3 w-3 rounded-full hover:bg-amber-200"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Camping Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Camping Options
              </label>
              <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                {availableCampingOptions.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">No camping options available</p>
                ) : (
                  <div className="p-2">
                    {availableCampingOptions.map((option) => (
                      <label key={option.id} className="flex items-start p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={formData.campingOptionIds.includes(option.id)}
                          onChange={() => handleCampingOptionToggle(option.id)}
                          className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded mt-1"
                        />
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-gray-900">{option.name}</div>
                          <div className="text-xs text-gray-500">${option.pricePerPerson}/person</div>
                          {option.description && (
                            <div className="text-xs text-gray-500">{option.description}</div>
                          )}
                          {option.maxOccupancy && option.currentOccupancy !== undefined && (
                            <div className="text-xs text-gray-500">
                              {option.currentOccupancy}/{option.maxOccupancy} occupied
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedCampingOptions.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">Selected options:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedCampingOptions.map((option) => (
                      <span
                        key={option.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {option.name}
                        <button
                          type="button"
                          onClick={() => handleCampingOptionToggle(option.id)}
                          className="ml-1 h-3 w-3 rounded-full hover:bg-blue-200"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reason for Changes */}
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Changes *
              </label>
              <textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => handleReasonChange(e.target.value)}
                placeholder="Explain why these changes are being made..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
              {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
            </div>

            {/* Notification Toggle */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.sendNotification}
                  onChange={(e) => handleNotificationToggle(e.target.checked)}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Send notification email to user about these changes
                </span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              {hasChanges ? 'Changes detected' : 'No changes made'}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !hasChanges}
                className="inline-flex items-center px-4 py-2 text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegistrationEditForm; 