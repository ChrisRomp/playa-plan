import { useState, useEffect } from 'react';
import { X, Clock, User, Eye, AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from '../../common/LoadingSpinner';

// TODO: Replace with actual API types when implemented
interface AuditRecord {
  id: string;
  adminUserId: string;
  actionType: 'REGISTRATION_EDIT' | 'REGISTRATION_CANCEL' | 'PAYMENT_REFUND' | 
              'WORK_SHIFT_ADD' | 'WORK_SHIFT_REMOVE' | 'WORK_SHIFT_MODIFY' |
              'CAMPING_OPTION_ADD' | 'CAMPING_OPTION_REMOVE' | 'CAMPING_OPTION_MODIFY';
  targetRecordType: 'REGISTRATION' | 'USER' | 'PAYMENT' | 'WORK_SHIFT' | 'CAMPING_OPTION';
  targetRecordId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason: string;
  transactionId?: string;
  createdAt: string;
  adminUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface AuditTrailViewProps {
  /** ID of the registration to view audit trail for */
  registrationId: string;
  /** Handler for closing the view */
  onClose: () => void;
}

/**
 * Component for displaying the audit trail history of a registration
 * Shows all administrative actions taken on the registration
 */
export function AuditTrailView({
  registrationId,
  onClose,
}: AuditTrailViewProps) {
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data for development - replace with actual API call
  useEffect(() => {
    const fetchAuditTrail = async () => {
      setLoading(true);
      setError(null);
      try {
        // TODO: Replace with actual API call to /admin/registrations/:id/audit-trail
        // const data = await adminRegistrationsApi.getAuditTrail(registrationId);
        
        // Mock data for development
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mockData: AuditRecord[] = [
          {
            id: '1',
            adminUserId: 'admin1',
            actionType: 'REGISTRATION_EDIT',
            targetRecordType: 'REGISTRATION',
            targetRecordId: registrationId,
            oldValues: { status: 'PENDING' },
            newValues: { status: 'CONFIRMED' },
            reason: 'Approved after payment verification',
            createdAt: '2024-01-20T10:30:00Z',
            adminUser: {
              id: 'admin1',
              email: 'admin@camp.org',
              firstName: 'Admin',
              lastName: 'User',
            },
          },
          {
            id: '2',
            adminUserId: 'admin1',
            actionType: 'WORK_SHIFT_ADD',
            targetRecordType: 'WORK_SHIFT',
            targetRecordId: 'job1',
            oldValues: undefined,
            newValues: { jobName: 'Kitchen Helper', registrationId },
            reason: 'Added kitchen shift per user request',
            transactionId: 'tx-123',
            createdAt: '2024-01-22T14:15:00Z',
            adminUser: {
              id: 'admin1',
              email: 'admin@camp.org',
              firstName: 'Admin',
              lastName: 'User',
            },
          },
        ];
        
        setAuditRecords(mockData);
      } catch (err) {
        setError('Failed to load audit trail');
        console.error('Error fetching audit trail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditTrail();
  }, [registrationId]);

  const getActionTypeLabel = (actionType: AuditRecord['actionType']): string => {
    const labels: Record<AuditRecord['actionType'], string> = {
      'REGISTRATION_EDIT': 'Registration Modified',
      'REGISTRATION_CANCEL': 'Registration Cancelled',
      'PAYMENT_REFUND': 'Payment Refunded',
      'WORK_SHIFT_ADD': 'Work Shift Added',
      'WORK_SHIFT_REMOVE': 'Work Shift Removed',
      'WORK_SHIFT_MODIFY': 'Work Shift Modified',
      'CAMPING_OPTION_ADD': 'Camping Option Added',
      'CAMPING_OPTION_REMOVE': 'Camping Option Removed',
      'CAMPING_OPTION_MODIFY': 'Camping Option Modified',
    };
    return labels[actionType] || actionType;
  };

  const getActionTypeColor = (actionType: AuditRecord['actionType']): string => {
    const colors: Record<string, string> = {
      'REGISTRATION_EDIT': 'bg-blue-100 text-blue-800',
      'REGISTRATION_CANCEL': 'bg-red-100 text-red-800',
      'PAYMENT_REFUND': 'bg-yellow-100 text-yellow-800',
      'WORK_SHIFT_ADD': 'bg-green-100 text-green-800',
      'WORK_SHIFT_REMOVE': 'bg-red-100 text-red-800',
      'WORK_SHIFT_MODIFY': 'bg-blue-100 text-blue-800',
      'CAMPING_OPTION_ADD': 'bg-green-100 text-green-800',
      'CAMPING_OPTION_REMOVE': 'bg-red-100 text-red-800',
      'CAMPING_OPTION_MODIFY': 'bg-blue-100 text-blue-800',
    };
    return colors[actionType] || 'bg-gray-100 text-gray-800';
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const renderValueChange = (oldValues?: Record<string, unknown>, newValues?: Record<string, unknown>) => {
    if (!oldValues && !newValues) return null;

    const changes: Array<{ key: string; old?: unknown; new?: unknown }> = [];
    
    // Collect all unique keys
    const allKeys = new Set([
      ...(oldValues ? Object.keys(oldValues) : []),
      ...(newValues ? Object.keys(newValues) : []),
    ]);

    allKeys.forEach(key => {
      const oldValue = oldValues?.[key];
      const newValue = newValues?.[key];
      
      if (oldValue !== newValue) {
        changes.push({ key, old: oldValue, new: newValue });
      }
    });

    if (changes.length === 0) return null;

    return (
      <div className="mt-2 text-sm">
        <div className="font-medium text-gray-700 mb-1">Changes:</div>
        <div className="space-y-1">
          {changes.map(({ key, old, new: newVal }) => (
            <div key={key} className="text-xs text-gray-600">
              <span className="font-medium">{key}:</span>{' '}
              {old !== undefined && (
                <span className="text-red-600">
                  {typeof old === 'object' ? JSON.stringify(old) : String(old)}
                </span>
              )}
              {old !== undefined && newVal !== undefined && ' → '}
              {newVal !== undefined && (
                <span className="text-green-600">
                  {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const groupedRecords = auditRecords.reduce((groups, record) => {
    const key = record.transactionId || record.id;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record);
    return groups;
  }, {} as Record<string, AuditRecord[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Eye size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Audit Trail</h2>
              <p className="text-sm text-gray-600">Registration modification history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Audit Trail</h3>
                <p className="text-gray-600">{error}</p>
              </div>
            </div>
          ) : auditRecords.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Audit Records</h3>
                <p className="text-gray-600">This registration has no modification history.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedRecords).map(([groupKey, records]) => {
                const isGroup = records.length > 1;
                const primaryRecord = records[0];
                
                return (
                  <div key={groupKey} className="bg-gray-50 rounded-lg border">
                    {/* Primary record or group header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionTypeColor(primaryRecord.actionType)}`}>
                              {getActionTypeLabel(primaryRecord.actionType)}
                            </span>
                            {isGroup && (
                              <span className="text-xs text-gray-500">
                                +{records.length - 1} related changes
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                            <div className="flex items-center space-x-1">
                              <User size={14} />
                              <span>{primaryRecord.adminUser.firstName} {primaryRecord.adminUser.lastName}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock size={14} />
                              <span>{formatDateTime(primaryRecord.createdAt)}</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{primaryRecord.reason}</p>
                          {renderValueChange(primaryRecord.oldValues, primaryRecord.newValues)}
                        </div>
                      </div>
                    </div>

                    {/* Additional records in the group */}
                    {isGroup && (
                      <div className="border-t border-gray-200">
                        {records.slice(1).map((record) => (
                          <div key={record.id} className="p-4 border-b border-gray-100 last:border-b-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionTypeColor(record.actionType)}`}>
                                    {getActionTypeLabel(record.actionType)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 mb-2">{record.reason}</p>
                                {renderValueChange(record.oldValues, record.newValues)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {auditRecords.length > 0 && (
              <>Showing {auditRecords.length} audit record{auditRecords.length !== 1 ? 's' : ''}</>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuditTrailView; 