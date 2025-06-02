import { useState } from 'react';
import { X, AlertTriangle, Trash2, DollarSign } from 'lucide-react';
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
  payments: Array<{
    id: string;
    amount: number;
    status: string;
  }>;
}

interface RegistrationCancelFormProps {
  /** The registration to cancel */
  registration: Registration;
  /** Whether the form is currently submitting */
  loading?: boolean;
  /** Handler for form submission */
  onSubmit: (data: RegistrationCancelData) => void;
  /** Handler for closing the form */
  onClose: () => void;
}

interface RegistrationCancelData {
  reason: string;
  sendNotification: boolean;
  processRefund: boolean;
}

/**
 * Form component for cancelling user registrations
 * Includes refund prompting for paid registrations and notification options
 */
export function RegistrationCancelForm({
  registration,
  loading = false,
  onSubmit,
  onClose,
}: RegistrationCancelFormProps) {
  const [formData, setFormData] = useState<RegistrationCancelData>({
    reason: '',
    sendNotification: false,
    processRefund: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate total paid amount
  const totalPaid = registration.payments
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + p.amount, 0);

  const hasPayments = totalPaid > 0;

  const handleReasonChange = (reason: string) => {
    setFormData(prev => ({ ...prev, reason }));
    setErrors(prev => ({ ...prev, reason: '' }));
  };

  const handleNotificationToggle = (sendNotification: boolean) => {
    setFormData(prev => ({ ...prev, sendNotification }));
  };

  const handleRefundToggle = (processRefund: boolean) => {
    setFormData(prev => ({ ...prev, processRefund }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.reason.trim()) {
      newErrors.reason = 'Please provide a reason for cancelling this registration.';
    }

    if (formData.reason.trim().length < 10) {
      newErrors.reason = 'Please provide a more detailed reason (at least 10 characters).';
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

  // Show error if registration is already cancelled
  if (registration.status === 'CANCELLED') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Already Cancelled</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle size={20} />
              <p>This registration has already been cancelled.</p>
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
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={16} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Cancel Registration</h2>
                <p className="text-sm text-gray-600">
                  {registration.user.firstName} {registration.user.lastName}
                </p>
              </div>
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
            {/* Warning */}
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    This action cannot be undone
                  </h3>
                  <p className="mt-1 text-sm text-red-700">
                    Cancelling this registration will remove all associated work shifts and 
                    release camping options. The user will need to re-register if they want 
                    to participate.
                  </p>
                </div>
              </div>
            </div>

            {/* Registration Details */}
            <div className="bg-gray-50 rounded-md p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Registration Details</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Year: {registration.year}</div>
                <div>Status: <span className="font-medium">{registration.status}</span></div>
                <div>Registered: {new Date(registration.createdAt).toLocaleDateString()}</div>
                {hasPayments && (
                  <div className="flex items-center text-green-600 font-medium">
                    <DollarSign size={14} className="mr-1" />
                    Total Paid: ${totalPaid.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Refund Option */}
            {hasPayments && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <div className="flex items-start">
                  <DollarSign className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="ml-3 flex-1">
                    <h4 className="text-sm font-medium text-amber-800">Payment Refund</h4>
                    <p className="mt-1 text-sm text-amber-700">
                      This registration has payments totaling ${totalPaid.toFixed(2)}. 
                      Do you want to process a refund?
                    </p>
                    <div className="mt-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.processRefund}
                          onChange={(e) => handleRefundToggle(e.target.checked)}
                          className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-amber-800">
                          Process refund of ${totalPaid.toFixed(2)}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reason for Cancellation */}
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Cancellation *
              </label>
              <textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => handleReasonChange(e.target.value)}
                placeholder="Explain why this registration is being cancelled..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
              {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
            </div>

            {/* Notification Toggle */}
            <div>
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.sendNotification}
                  onChange={(e) => handleNotificationToggle(e.target.checked)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded mt-1"
                />
                <div className="ml-2">
                  <span className="text-sm text-gray-700 font-medium">
                    Send cancellation notification to user
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    The user will receive an email notification about the cancellation. 
                    This is unchecked by default.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              {hasPayments && formData.processRefund 
                ? `Refund of $${totalPaid.toFixed(2)} will be processed`
                : hasPayments 
                ? 'No refund will be processed'
                : 'No payments to refund'
              }
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
                disabled={loading}
                className="inline-flex items-center px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} className="mr-2" />
                    Cancel Registration
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

export default RegistrationCancelForm; 