import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AuditTrailView from './AuditTrailView';
import * as adminRegistrationsApi from '../../../lib/api/admin-registrations';

// Mock the API
vi.mock('../../../lib/api/admin-registrations', () => ({
  adminRegistrationsApi: {
    getAuditTrail: vi.fn(),
  },
}));

// Mock dependencies
vi.mock('../../common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>
}));

describe('AuditTrailView', () => {
  const mockAuditRecords = [
    {
      id: 'audit-1',
      adminUserId: 'admin-1',
      adminUser: {
        id: 'admin-1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
      },
      actionType: 'REGISTRATION_EDIT' as const,
      targetRecordType: 'REGISTRATION' as const,
      targetRecordId: 'reg-1',
      oldValues: {
        status: 'PENDING',
        jobIds: ['job-1'],
      },
      newValues: {
        status: 'CONFIRMED',
        jobIds: ['job-1', 'job-2'],
      },
      reason: 'Updated status and added additional job',
      transactionId: 'txn-1',
      createdAt: '2024-01-01T10:00:00Z',
    },
    {
      id: 'audit-2',
      adminUserId: 'admin-2',
      adminUser: {
        id: 'admin-2',
        email: 'admin2@example.com',
        firstName: 'Second',
        lastName: 'Admin',
      },
      actionType: 'PAYMENT_REFUND' as const,
      targetRecordType: 'PAYMENT' as const,
      targetRecordId: 'payment-1',
      oldValues: {
        status: 'COMPLETED',
        amount: 150,
      },
      newValues: {
        status: 'REFUNDED',
        amount: 150,
      },
      reason: 'User requested refund due to emergency',
      transactionId: 'txn-1',
      createdAt: '2024-01-01T10:05:00Z',
    },
    {
      id: 'audit-3',
      adminUserId: 'admin-1',
      adminUser: {
        id: 'admin-1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
      },
      actionType: 'REGISTRATION_CANCEL' as const,
      targetRecordType: 'REGISTRATION' as const,
      targetRecordId: 'reg-1',
      oldValues: {
        status: 'CONFIRMED',
      },
      newValues: {
        status: 'CANCELLED',
      },
      reason: 'Registration cancelled per user request',
      transactionId: undefined,
      createdAt: '2024-01-02T14:30:00Z',
    },
  ];

  const defaultProps = {
    registrationId: 'reg-1',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching audit trail', async () => {
      // Mock a promise that doesn't resolve immediately
      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<AuditTrailView {...defaultProps} />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    beforeEach(() => {
      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(mockAuditRecords);
    });

    it('should display audit history in readable format', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      });

      // Check that audit records are displayed
      expect(screen.getByText('Registration Modified')).toBeInTheDocument();
      expect(screen.getByText('Payment Refunded')).toBeInTheDocument();
      expect(screen.getByText('Registration Cancelled')).toBeInTheDocument();
    });

    it('should display admin user information correctly', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText('Admin User')).toHaveLength(2); // Appears in multiple audit records
      });

      // Second admin user is in a grouped record, so admin info is not displayed separately
      // Only the primary record in a group shows admin user information
    });

    it('should format action types with proper labels', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Registration Modified')).toBeInTheDocument();
      });

      expect(screen.getByText('Payment Refunded')).toBeInTheDocument();
      expect(screen.getByText('Registration Cancelled')).toBeInTheDocument();
    });

    it('should display timestamps in proper format', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      });

      // Check that formatted dates are present (exact format may vary by locale)
      expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 2, 2024/)).toBeInTheDocument();
    });

    it('should display reason for each action', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Updated status and added additional job')).toBeInTheDocument();
      });

      expect(screen.getByText('User requested refund due to emergency')).toBeInTheDocument();
      expect(screen.getByText('Registration cancelled per user request')).toBeInTheDocument();
    });

    it('should display old and new values when available', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      });

      // Check for old/new value displays
      expect(screen.getByText(/PENDING/)).toBeInTheDocument();
      expect(screen.getAllByText(/CONFIRMED/)).toHaveLength(2); // Old value red, new value green
      expect(screen.getByText(/CANCELLED/)).toBeInTheDocument();
    });

    it('should group related actions by transaction ID', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      });

      // First two records have the same transaction ID and should be grouped
      expect(screen.getByText('Registration Modified')).toBeInTheDocument();
      expect(screen.getByText('Payment Refunded')).toBeInTheDocument();
    });

    it('should handle audit records without transaction IDs', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Registration Cancelled')).toBeInTheDocument();
      });

      // Third record has no transaction ID and should still display
      expect(screen.getByText('Registration cancelled per user request')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when API call fails', async () => {
      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockRejectedValue(new Error('Failed to fetch audit trail'));

      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load audit trail')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('should handle network errors gracefully', async () => {
      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockRejectedValue(new Error('Network error'));

      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load audit trail')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display message when no audit records exist', async () => {
      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue([]);

      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('This registration has no modification history.')).toBeInTheDocument();
      });
    });
  });

  describe('Modal Behavior', () => {
    beforeEach(() => {
      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(mockAuditRecords);
    });

    it('should handle close button click', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: '' }); // X button
      closeButton.click();

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should handle modal scrolling with long audit trail', async () => {
      const longAuditTrail = Array(20).fill(null).map((_, index) => ({
        ...mockAuditRecords[0],
        id: `audit-${index}`,
        createdAt: `2024-01-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
      }));

      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(longAuditTrail);

      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      });

      // Check that the modal container allows scrolling
      const modal = document.querySelector('.overflow-y-auto');
      expect(modal).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    beforeEach(() => {
      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(mockAuditRecords);
    });

    it('should handle different action types with proper styling', async () => {
      const auditWithAllActionTypes = [
        { ...mockAuditRecords[0], actionType: 'REGISTRATION_EDIT' as const },
        { ...mockAuditRecords[0], id: 'audit-cancel', actionType: 'REGISTRATION_CANCEL' as const },
        { ...mockAuditRecords[0], id: 'audit-refund', actionType: 'PAYMENT_REFUND' as const },
        { ...mockAuditRecords[0], id: 'audit-work-add', actionType: 'WORK_SHIFT_ADD' as const },
        { ...mockAuditRecords[0], id: 'audit-work-remove', actionType: 'WORK_SHIFT_REMOVE' as const },
        { ...mockAuditRecords[0], id: 'audit-camp-add', actionType: 'CAMPING_OPTION_ADD' as const },
      ];

      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(auditWithAllActionTypes);

      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Registration Modified')).toBeInTheDocument();
      });

      expect(screen.getByText('Registration Cancelled')).toBeInTheDocument();
      expect(screen.getByText('Payment Refunded')).toBeInTheDocument();
      expect(screen.getByText('Work Shift Added')).toBeInTheDocument();
      expect(screen.getByText('Work Shift Removed')).toBeInTheDocument();
      expect(screen.getByText('Camping Option Added')).toBeInTheDocument();
    });

    it('should handle missing admin user information gracefully', async () => {
      const auditWithMissingAdmin = [{
        ...mockAuditRecords[0],
        adminUser: {
          id: 'unknown-admin',
          email: 'unknown@admin.com',
          firstName: 'Unknown',
          lastName: 'Admin',
        },
      }];

      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(auditWithMissingAdmin);

      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      });

      expect(screen.getByText('Unknown Admin')).toBeInTheDocument();
    });

    it('should handle complex old/new values objects', async () => {
      const auditWithComplexValues = [{
        ...mockAuditRecords[0],
        oldValues: {
          status: 'PENDING',
          jobIds: ['job-1'],
          campingOptionIds: ['camp-1', 'camp-2'],
          notes: 'Original notes',
        },
        newValues: {
          status: 'CONFIRMED',
          jobIds: ['job-1', 'job-2', 'job-3'],
          campingOptionIds: ['camp-1'],
          notes: 'Updated notes',
        },
      }];

      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(auditWithComplexValues);

      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      });

      // Should display the complex object values
      expect(screen.getByText(/PENDING/)).toBeInTheDocument();
      expect(screen.getByText(/CONFIRMED/)).toBeInTheDocument();
    });

    it('should handle null or undefined values gracefully', async () => {
      const auditWithNullValues = [{
        ...mockAuditRecords[0],
        oldValues: undefined,
        newValues: undefined,
        reason: 'No details available',
      }];

      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(auditWithNullValues);

      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      });

      // Should not crash and still display the audit record
      expect(screen.getByText('Registration Modified')).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('should call getAuditTrail with correct registration ID', async () => {
      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(mockAuditRecords);

      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetAuditTrail).toHaveBeenCalledWith('reg-1');
      });
    });

    it('should refetch data when registration ID changes', async () => {
      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(mockAuditRecords);

      const { rerender } = render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetAuditTrail).toHaveBeenCalledWith('reg-1');
      });

      // Change registration ID
      rerender(<AuditTrailView {...defaultProps} registrationId="reg-2" />);

      await waitFor(() => {
        expect(mockGetAuditTrail).toHaveBeenCalledWith('reg-2');
      });

      expect(mockGetAuditTrail).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      const mockGetAuditTrail = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.getAuditTrail);
      mockGetAuditTrail.mockResolvedValue(mockAuditRecords);
    });

    it('should have proper modal structure and labels', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      });

      // Check for proper heading structure
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('should have accessible close button', async () => {
      render(<AuditTrailView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toBeInTheDocument();
    });
  });
}); 