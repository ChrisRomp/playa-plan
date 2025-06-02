import { useMemo } from 'react';
import { Edit, Trash2, Eye } from 'lucide-react';
import { DataTable, DataTableColumn } from '../../common/DataTable/DataTable';

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

interface RegistrationSearchTableProps {
  /** Array of registration data to display */
  registrations: Registration[];
  /** Handler for editing a registration */
  onEditRegistration: (registrationId: string) => void;
  /** Handler for cancelling a registration */
  onCancelRegistration: (registrationId: string) => void;
  /** Handler for viewing audit trail */
  onViewAuditTrail: (registrationId: string) => void;
  /** Optional handler for row clicks */
  onRowClick?: (registration: Registration) => void;
  /** Whether to show the actions column */
  showActions?: boolean;
  /** Custom empty message */
  emptyMessage?: string;
}

/**
 * Reusable table component for displaying and managing registrations
 * Used in admin registration management interfaces
 */
export function RegistrationSearchTable({
  registrations,
  onEditRegistration,
  onCancelRegistration,
  onViewAuditTrail,
  onRowClick,
  showActions = true,
  emptyMessage = 'No registrations found',
}: RegistrationSearchTableProps) {
  // Define table columns
  const columns: DataTableColumn<Registration>[] = useMemo(() => {
    const baseColumns: DataTableColumn<Registration>[] = [
      {
        id: 'user',
        header: 'User',
        accessor: (row) => (
          <div>
            <div className="font-medium text-gray-900">
              {row.user.firstName} {row.user.lastName}
            </div>
            {row.user.playaName && (
              <div className="text-sm text-gray-500">{row.user.playaName}</div>
            )}
          </div>
        ),
        sortable: true,
      },
      {
        id: 'email',
        header: 'Email',
        accessor: (row) => row.user.email,
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
        id: 'status',
        header: 'Status',
        accessor: (row) => (
          <span
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              row.status === 'CONFIRMED'
                ? 'bg-green-100 text-green-800'
                : row.status === 'PENDING'
                ? 'bg-yellow-100 text-yellow-800'
                : row.status === 'WAITLISTED'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {row.status}
          </span>
        ),
        sortable: true,
      },
      {
        id: 'jobs',
        header: 'Work Shifts',
        accessor: (row) => {
          if (row.jobs.length === 0) return 'No shifts assigned';
          return row.jobs.map(j => j.job.name).join(', ');
        },
        sortable: false,
        hideOnMobile: true,
      },
      {
        id: 'payments',
        header: 'Payment',
        accessor: (row) => {
          const totalPaid = row.payments
            .filter(p => p.status === 'COMPLETED')
            .reduce((sum, p) => sum + p.amount, 0);
          
          if (totalPaid === 0) return 'No payments';
          return `$${totalPaid.toFixed(2)}`;
        },
        sortable: false,
        hideOnMobile: true,
      },
      {
        id: 'createdAt',
        header: 'Registered',
        accessor: (row) => new Date(row.createdAt).toLocaleDateString(),
        sortable: true,
        hideOnMobile: true,
      },
    ];

    // Add actions column if requested
    if (showActions) {
      baseColumns.push({
        id: 'actions',
        header: 'Actions',
        accessor: (row) => (
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewAuditTrail(row.id);
              }}
              className="text-blue-600 hover:text-blue-800 p-1 rounded"
              title="View audit trail"
            >
              <Eye size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditRegistration(row.id);
              }}
              className="text-amber-600 hover:text-amber-800 p-1 rounded"
              title="Edit registration"
            >
              <Edit size={16} />
            </button>
            {row.status !== 'CANCELLED' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelRegistration(row.id);
                }}
                className="text-red-600 hover:text-red-800 p-1 rounded"
                title="Cancel registration"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ),
        sortable: false,
      });
    }

    return baseColumns;
  }, [showActions, onEditRegistration, onCancelRegistration, onViewAuditTrail]);

  return (
    <div className="bg-white rounded-lg shadow">
      <DataTable
        data={registrations}
        columns={columns}
        getRowKey={(row) => row.id}
        filterable={true}
        paginated={true}
        defaultPageSize={25}
        caption="Registration search results table"
        emptyMessage={emptyMessage}
        initialSort={{ id: 'createdAt', direction: 'desc' }}
        onRowClick={onRowClick}
      />
    </div>
  );
}

export default RegistrationSearchTable; 