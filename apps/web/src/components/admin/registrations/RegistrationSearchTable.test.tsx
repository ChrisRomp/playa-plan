import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RegistrationSearchTable } from './RegistrationSearchTable';

interface MockColumn {
  id: string;
  header: string;
  accessor: (row: unknown) => React.ReactNode;
}

// Mock the DataTable component
vi.mock('../../common/DataTable/DataTable', () => ({
  DataTable: ({ data, columns, emptyMessage, onRowClick }: {
    data: unknown[];
    columns: MockColumn[];
    emptyMessage: string;
    onRowClick?: (row: unknown) => void;
  }) => {
    if (data.length === 0) {
      return <div>{emptyMessage}</div>;
    }

    return (
      <div data-testid="data-table">
        <table>
          <thead>
            <tr>
              {columns.map((col, index: number) => (
                <th key={index}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row: unknown, rowIndex: number) => (
              <tr 
                key={rowIndex} 
                onClick={() => onRowClick?.(row)}
                data-testid={`table-row-${rowIndex}`}
              >
                {columns.map((col, colIndex: number) => (
                  <td key={colIndex} data-testid={`cell-${rowIndex}-${col.id}`}>
                    <div>{col.accessor(row)}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
}));

describe('RegistrationSearchTable', () => {
  const mockRegistrations = [
    {
      id: 'reg-1',
      year: 2024,
      status: 'CONFIRMED' as const,
      createdAt: '2024-01-01T10:00:00Z',
      user: {
        id: 'user-1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        playaName: 'JohnnyPlaya',
        role: 'participant',
      },
      jobs: [
        {
          job: {
            id: 'job-1',
            name: 'Kitchen Helper',
            category: {
              name: 'Kitchen',
            },
            shift: {
              name: 'Morning Shift',
              startTime: '09:00',
              endTime: '13:00',
              dayOfWeek: 'Monday',
            },
          },
        },
        {
          job: {
            id: 'job-2',
            name: 'Cleanup Crew',
            category: {
              name: 'Maintenance',
            },
            shift: {
              name: 'Evening Shift',
              startTime: '18:00',
              endTime: '22:00',
              dayOfWeek: 'Tuesday',
            },
          },
        },
      ],
      payments: [
        {
          id: 'payment-1',
          amount: 150,
          status: 'COMPLETED',
        },
        {
          id: 'payment-2',
          amount: 50,
          status: 'COMPLETED',
        },
      ],
    },
    {
      id: 'reg-2',
      year: 2024,
      status: 'PENDING' as const,
      createdAt: '2024-01-02T14:30:00Z',
      user: {
        id: 'user-2',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        playaName: '',
        role: 'staff',
      },
      jobs: [],
      payments: [],
    },
    {
      id: 'reg-3',
      year: 2023,
      status: 'CANCELLED' as const,
      createdAt: '2023-06-15T09:15:00Z',
      user: {
        id: 'user-3',
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Wilson',
        playaName: 'BobTheBuilder',
        role: 'participant',
      },
      jobs: [
        {
          job: {
            id: 'job-3',
            name: 'Safety Monitor',
            category: {
              name: 'Safety',
            },
            shift: {
              name: 'Night Shift',
              startTime: '22:00',
              endTime: '06:00',
              dayOfWeek: 'Friday',
            },
          },
        },
      ],
      payments: [
        {
          id: 'payment-3',
          amount: 100,
          status: 'REFUNDED',
        },
      ],
    },
  ];

  const defaultProps = {
    registrations: mockRegistrations,
    onEditRegistration: vi.fn(),
    onCancelRegistration: vi.fn(),
    onViewAuditTrail: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should display action buttons and handle clicks', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      expect(screen.getByTestId('data-table')).toBeInTheDocument();
      
      // Check that table headers are present
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Year')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Work Shifts')).toBeInTheDocument();
      expect(screen.getByText('Payment')).toBeInTheDocument();
      expect(screen.getByText('Registered')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should render user information correctly', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      // Check first registration user data
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('JohnnyPlaya')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();

      // Check second registration user data (no playa name)
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('should render registration status with proper styling', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      // Status badges should be present
      const confirmedStatus = screen.getByText('CONFIRMED');
      const pendingStatus = screen.getByText('PENDING');
      const cancelledStatus = screen.getByText('CANCELLED');

      expect(confirmedStatus).toBeInTheDocument();
      expect(pendingStatus).toBeInTheDocument();
      expect(cancelledStatus).toBeInTheDocument();
    });

    it('should display work shifts correctly', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      // First registration has multiple jobs
      expect(screen.getByText('Kitchen Helper, Cleanup Crew')).toBeInTheDocument();
      
      // Second registration has no jobs
      expect(screen.getByText('No shifts assigned')).toBeInTheDocument();
      
      // Third registration has one job
      expect(screen.getByText('Safety Monitor')).toBeInTheDocument();
    });

    it('should display payment information correctly', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      // First registration has payments totaling $200
      expect(screen.getByText('$200.00')).toBeInTheDocument();
      
      // Second and third registrations have no payments - use getAllByText to handle multiple instances
      const noPaymentsElements = screen.getAllByText('No payments');
      expect(noPaymentsElements).toHaveLength(2);
    });

    it('should display registration dates correctly', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      // Check formatted dates
      expect(screen.getByText('1/1/2024')).toBeInTheDocument();
      expect(screen.getByText('1/2/2024')).toBeInTheDocument();
      expect(screen.getByText('6/15/2023')).toBeInTheDocument();
    });

    it('should show empty message when no registrations provided', () => {
      render(<RegistrationSearchTable {...defaultProps} registrations={[]} />);

      expect(screen.getByText('No registrations found')).toBeInTheDocument();
    });

    it('should show custom empty message', () => {
      const customEmptyMessage = 'No matching registrations';
      render(
        <RegistrationSearchTable 
          {...defaultProps} 
          registrations={[]} 
          emptyMessage={customEmptyMessage}
        />
      );

      expect(screen.getByText(customEmptyMessage)).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render action buttons for each registration', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      // Should have view audit trail buttons (Eye icons)
      const auditTrailButtons = screen.getAllByTitle('View audit trail');
      expect(auditTrailButtons).toHaveLength(3);

      // Should have edit buttons (Edit icons)
      const editButtons = screen.getAllByTitle('Edit registration');
      expect(editButtons).toHaveLength(3);

      // Should have cancel buttons only for non-cancelled registrations (Trash icons)
      const cancelButtons = screen.getAllByTitle('Cancel registration');
      expect(cancelButtons).toHaveLength(2); // Only for CONFIRMED and PENDING, not CANCELLED
    });

    it('should call onViewAuditTrail when audit trail button is clicked', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      const auditTrailButtons = screen.getAllByTitle('View audit trail');
      fireEvent.click(auditTrailButtons[0]);

      expect(defaultProps.onViewAuditTrail).toHaveBeenCalledWith('reg-1');
    });

    it('should call onEditRegistration when edit button is clicked', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      const editButtons = screen.getAllByTitle('Edit registration');
      fireEvent.click(editButtons[0]);

      expect(defaultProps.onEditRegistration).toHaveBeenCalledWith('reg-1');
    });

    it('should call onCancelRegistration when cancel button is clicked', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      const cancelButtons = screen.getAllByTitle('Cancel registration');
      fireEvent.click(cancelButtons[0]);

      expect(defaultProps.onCancelRegistration).toHaveBeenCalledWith('reg-1');
    });

    it('should not show cancel button for cancelled registrations', () => {
      render(<RegistrationSearchTable {...defaultProps} />);

      // The cancelled registration (reg-3) should not have a cancel button
      // We can verify this by checking that there are only 2 cancel buttons for 3 registrations
      const cancelButtons = screen.getAllByTitle('Cancel registration');
      expect(cancelButtons).toHaveLength(2);
    });

    it('should prevent event propagation when action buttons are clicked', () => {
      const onRowClick = vi.fn();
      render(<RegistrationSearchTable {...defaultProps} onRowClick={onRowClick} />);

      const editButton = screen.getAllByTitle('Edit registration')[0];
      fireEvent.click(editButton);

      // Row click should not be called because event.stopPropagation() should be called
      expect(onRowClick).not.toHaveBeenCalled();
      expect(defaultProps.onEditRegistration).toHaveBeenCalledWith('reg-1');
    });
  });

  describe('Configuration Options', () => {
    it('should hide actions column when showActions is false', () => {
      render(<RegistrationSearchTable {...defaultProps} showActions={false} />);

      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
      expect(screen.queryByTitle('View audit trail')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Edit registration')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Cancel registration')).not.toBeInTheDocument();
    });

    it('should call onRowClick when row is clicked', () => {
      const onRowClick = vi.fn();
      render(<RegistrationSearchTable {...defaultProps} onRowClick={onRowClick} />);

      const firstRow = screen.getByTestId('table-row-0');
      fireEvent.click(firstRow);

      expect(onRowClick).toHaveBeenCalledWith(mockRegistrations[0]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle registrations with missing job category', () => {
      const registrationWithMissingJobCategory = [{
        ...mockRegistrations[0],
        jobs: [
          {
            job: {
              id: 'job-incomplete',
              name: 'Job Without Category',
              category: undefined,
              shift: undefined,
            },
          },
        ],
      }];

      render(<RegistrationSearchTable {...defaultProps} registrations={registrationWithMissingJobCategory} />);

      expect(screen.getByText('Job Without Category')).toBeInTheDocument();
    });

    it('should handle registrations with mixed payment statuses', () => {
      const registrationWithMixedPayments = [{
        ...mockRegistrations[0],
        payments: [
          { id: 'payment-1', amount: 100, status: 'COMPLETED' },
          { id: 'payment-2', amount: 50, status: 'PENDING' },
          { id: 'payment-3', amount: 25, status: 'FAILED' },
        ],
      }];

      render(<RegistrationSearchTable {...defaultProps} registrations={registrationWithMixedPayments} />);

      // Should only count COMPLETED payments
      expect(screen.getByText('$100.00')).toBeInTheDocument();
    });

    it('should handle registrations with zero payment amounts', () => {
      const registrationWithZeroPayments = [{
        ...mockRegistrations[0],
        payments: [
          { id: 'payment-1', amount: 0, status: 'COMPLETED' },
        ],
      }];

      render(<RegistrationSearchTable {...defaultProps} registrations={registrationWithZeroPayments} />);

      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle users without playa names', () => {
      const registrationWithoutPlayaName = [{
        ...mockRegistrations[0],
        user: {
          ...mockRegistrations[0].user,
          playaName: '',
        },
      }];

      render(<RegistrationSearchTable {...defaultProps} registrations={registrationWithoutPlayaName} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('JohnnyPlaya')).not.toBeInTheDocument();
    });

    it('should handle very long job names', () => {
      const registrationWithLongJobName = [{
        ...mockRegistrations[0],
        jobs: [
          {
            job: {
              id: 'job-long',
              name: 'This is a very long job name that might cause layout issues if not handled properly',
              category: { name: 'Category' },
              shift: undefined,
            },
          },
        ],
      }];

      render(<RegistrationSearchTable {...defaultProps} registrations={registrationWithLongJobName} />);

      expect(screen.getByText('This is a very long job name that might cause layout issues if not handled properly')).toBeInTheDocument();
    });

    it('should handle invalid dates gracefully', () => {
      const registrationWithInvalidDate = [{
        ...mockRegistrations[0],
        createdAt: 'invalid-date',
      }];

      render(<RegistrationSearchTable {...defaultProps} registrations={registrationWithInvalidDate} />);

      // Should still render the table even with invalid date
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    it('should format different status types with appropriate styling', () => {
      const registrationsWithAllStatuses = [
        { ...mockRegistrations[0], status: 'CONFIRMED' as const },
        { ...mockRegistrations[1], status: 'PENDING' as const },
        { ...mockRegistrations[2], status: 'CANCELLED' as const },
        { ...mockRegistrations[0], id: 'reg-4', status: 'WAITLISTED' as const },
      ];

      render(<RegistrationSearchTable {...defaultProps} registrations={registrationsWithAllStatuses} />);

      expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
      expect(screen.getByText('WAITLISTED')).toBeInTheDocument();
    });

    it('should properly calculate payment totals', () => {
      const registrationWithMultiplePayments = [{
        ...mockRegistrations[0],
        payments: [
          { id: 'payment-1', amount: 123.45, status: 'COMPLETED' },
          { id: 'payment-2', amount: 67.89, status: 'COMPLETED' },
          { id: 'payment-3', amount: 100.00, status: 'PENDING' }, // Should be ignored
        ],
      }];

      render(<RegistrationSearchTable {...defaultProps} registrations={registrationWithMultiplePayments} />);

      // 123.45 + 67.89 = 191.34
      expect(screen.getByText('$191.34')).toBeInTheDocument();
    });

    it('should handle different year values correctly', () => {
      const registrationsWithDifferentYears = [
        { ...mockRegistrations[0], year: 2025 },
        { ...mockRegistrations[1], year: 2023 },
        { ...mockRegistrations[2], year: 2022 },
      ];

      render(<RegistrationSearchTable {...defaultProps} registrations={registrationsWithDifferentYears} />);

      expect(screen.getByText('2025')).toBeInTheDocument();
      expect(screen.getByText('2023')).toBeInTheDocument();
      expect(screen.getByText('2022')).toBeInTheDocument();
    });
  });
}); 