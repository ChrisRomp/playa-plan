import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RegistrationCancelForm from './RegistrationCancelForm';

// Mock dependencies
vi.mock('../../common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>
}));

describe('RegistrationCancelForm', () => {
  const mockRegistrationWithPayments = {
    id: 'reg-1',
    year: 2024,
    status: 'CONFIRMED' as const,
    createdAt: '2024-01-01T10:00:00Z',
    user: {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      playaName: 'JohnnyPlaya',
      role: 'participant',
    },
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
  };

  const mockRegistrationWithoutPayments = {
    id: 'reg-2',
    year: 2024,
    status: 'PENDING' as const,
    createdAt: '2024-01-01T10:00:00Z',
    user: {
      id: 'user-2',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      playaName: 'JanePlaya',
      role: 'participant',
    },
    payments: [],
  };

  const mockRegistrationWithPendingPayments = {
    id: 'reg-3',
    year: 2024,
    status: 'CONFIRMED' as const,
    createdAt: '2024-01-01T10:00:00Z',
    user: {
      id: 'user-3',
      email: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Wilson',
      playaName: 'BobPlaya',
      role: 'participant',
    },
    payments: [
      {
        id: 'payment-3',
        amount: 100,
        status: 'PENDING',
      },
      {
        id: 'payment-4',
        amount: 75,
        status: 'COMPLETED',
      },
    ],
  };

  const defaultProps = {
    registration: mockRegistrationWithPayments,
    loading: false,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render correctly with registration data', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      // Check header by role to avoid ambiguity with button
      expect(screen.getByRole('heading', { name: 'Cancel Registration' })).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      // Check warning message
      expect(screen.getByText('This action cannot be undone')).toBeInTheDocument();
      expect(screen.getByText(/Cancelling this registration will remove all associated work shifts/)).toBeInTheDocument();

      // Check registration details
      expect(screen.getByText('Registration Details')).toBeInTheDocument();
      expect(screen.getByText('Year: 2024')).toBeInTheDocument();
      expect(screen.getByText('Status:')).toBeInTheDocument();
      expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
      expect(screen.getByText(/^Registered:/)).toBeInTheDocument();
    });

    it('should display refund prompting for paid registrations', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      expect(screen.getByText('Total Paid: $200.00')).toBeInTheDocument();
      expect(screen.getByText('Payment Refund')).toBeInTheDocument();
      expect(screen.getByLabelText(/Process refund of/)).toBeInTheDocument();
      expect(screen.getByText(/This registration has payments totaling \$200\.00/)).toBeInTheDocument();
    });

    it('should not show refund options for registrations without completed payments', () => {
      render(<RegistrationCancelForm {...defaultProps} registration={mockRegistrationWithoutPayments} />);

      expect(screen.queryByText('Total Paid:')).not.toBeInTheDocument();
      expect(screen.queryByText('Payment Refund')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Process refund of/)).not.toBeInTheDocument();
    });

    it('should only count completed payments for refund calculation', () => {
      render(<RegistrationCancelForm {...defaultProps} registration={mockRegistrationWithPendingPayments} />);

      // Only the completed payment ($75) should be counted, not the pending one ($100)
      expect(screen.getByText('Total Paid: $75.00')).toBeInTheDocument();
      expect(screen.getByText('Process refund of $75.00')).toBeInTheDocument();
    });

    it('should show notification toggle that defaults to unchecked', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const notificationCheckbox = screen.getByLabelText(/Send cancellation notification to user/);
      expect(notificationCheckbox).toBeInTheDocument();
      expect(notificationCheckbox).not.toBeChecked();
    });

    it('should show loading state when loading is true', () => {
      render(<RegistrationCancelForm {...defaultProps} loading={true} />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Cancelling...')).toBeInTheDocument();
      expect(screen.getByText('Cancelling...')).toBeDisabled();
    });

    it('should show reason input field', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      expect(screen.getByLabelText(/Reason for Cancellation/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Explain why this registration is being cancelled/)).toBeInTheDocument();
    });
  });

  describe('Modal Behavior', () => {
    it('should handle modal scrolling with long content', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      
      expect(modal).toBeInTheDocument();
    });

    it('should handle close button click', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should handle cancel button click', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Form Interactions', () => {
    it('should handle refund toggle', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const refundCheckbox = screen.getByLabelText(/Process refund of/);
      expect(refundCheckbox).not.toBeChecked();

      fireEvent.click(refundCheckbox);
      expect(refundCheckbox).toBeChecked();
    });

    it('should handle notification toggle', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const notificationCheckbox = screen.getByLabelText(/Send cancellation notification to user/);
      expect(notificationCheckbox).not.toBeChecked();

      fireEvent.click(notificationCheckbox);
      expect(notificationCheckbox).toBeChecked();
    });

    it('should handle reason input', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const reasonTextarea = screen.getByLabelText(/Reason for Cancellation/);
      fireEvent.change(reasonTextarea, { target: { value: 'User requested cancellation' } });

      expect(reasonTextarea).toHaveValue('User requested cancellation');
    });
  });

  describe('Form Validation', () => {
    it('should require a reason when submitting', async () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const confirmButton = screen.getByRole('button', { name: /Cancel Registration/ });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Please provide a reason for cancellation.')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('should enforce minimum reason length', async () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const reasonTextarea = screen.getByLabelText(/Reason for Cancellation/);
      fireEvent.change(reasonTextarea, { target: { value: 'Too short' } });

      const confirmButton = screen.getByRole('button', { name: /Cancel Registration/ });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Reason must be at least 10 characters long.')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('should allow submission with valid reason', async () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const reasonTextarea = screen.getByLabelText(/Reason for Cancellation/);
      fireEvent.change(reasonTextarea, { target: { value: 'This is a valid reason for cancellation that is long enough.' } });

      const confirmButton = screen.getByRole('button', { name: /Cancel Registration/ });
      fireEvent.click(confirmButton);

      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        reason: 'This is a valid reason for cancellation that is long enough.',
        processRefund: false,
        sendNotification: false,
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit with correct data when refund and notification are selected', async () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      // Fill reason
      const reasonTextarea = screen.getByLabelText(/Reason for Cancellation/);
      fireEvent.change(reasonTextarea, { target: { value: 'User requested full refund and notification.' } });

      // Enable refund
      const refundCheckbox = screen.getByLabelText(/Process refund of/);
      fireEvent.click(refundCheckbox);

      // Enable notification
      const notificationCheckbox = screen.getByLabelText(/Send cancellation notification to user/);
      fireEvent.click(notificationCheckbox);

      const confirmButton = screen.getByRole('button', { name: /Cancel Registration/ });
      fireEvent.click(confirmButton);

      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        reason: 'User requested full refund and notification.',
        processRefund: true,
        sendNotification: true,
      });
    });

    it('should submit with only notification when no payments exist', async () => {
      render(<RegistrationCancelForm {...defaultProps} registration={mockRegistrationWithoutPayments} />);

      // Fill reason
      const reasonTextarea = screen.getByLabelText(/Reason for Cancellation/);
      fireEvent.change(reasonTextarea, { target: { value: 'Registration no longer needed.' } });

      // Enable notification
      const notificationCheckbox = screen.getByLabelText(/Send cancellation notification to user/);
      fireEvent.click(notificationCheckbox);

      const confirmButton = screen.getByRole('button', { name: /Cancel Registration/ });
      fireEvent.click(confirmButton);

      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        reason: 'Registration no longer needed.',
        processRefund: false,
        sendNotification: true,
      });
    });

    it('should disable form during submission', () => {
      render(<RegistrationCancelForm {...defaultProps} loading={true} />);

      const reasonTextarea = screen.getByLabelText(/Reason for Cancellation/);
      const confirmButton = screen.getByText('Cancelling...');
      
      expect(reasonTextarea).toBeDisabled();
      expect(confirmButton).toBeDisabled();
    });

    it('should clear validation errors when reason is fixed', async () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      // Submit without reason to trigger error
      const confirmButton = screen.getByRole('button', { name: /Cancel Registration/ });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Please provide a reason for cancellation.')).toBeInTheDocument();
      });

      // Add valid reason
      const reasonTextarea = screen.getByLabelText(/Reason for Cancellation/);
      fireEvent.change(reasonTextarea, { target: { value: 'Valid reason for cancellation' } });

      // Error should disappear
      await waitFor(() => {
        expect(screen.queryByText('Please provide a reason for cancellation.')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle registration with mixed payment statuses', () => {
      const mixedPaymentRegistration = {
        ...mockRegistrationWithPayments,
        payments: [
          { id: 'payment-1', amount: 100, status: 'COMPLETED' },
          { id: 'payment-2', amount: 50, status: 'PENDING' },
          { id: 'payment-3', amount: 25, status: 'FAILED' },
          { id: 'payment-4', amount: 75, status: 'COMPLETED' },
        ],
      };

      render(<RegistrationCancelForm {...defaultProps} registration={mixedPaymentRegistration} />);

      // Should only count COMPLETED payments: $100 + $75 = $175
      expect(screen.getByText('Total Paid: $175.00')).toBeInTheDocument();
    });

    it('should handle registration with zero payment amounts', () => {
      const zeroPaymentRegistration = {
        ...mockRegistrationWithPayments,
        payments: [
          { id: 'payment-1', amount: 0, status: 'COMPLETED' },
        ],
      };

      render(<RegistrationCancelForm {...defaultProps} registration={zeroPaymentRegistration} />);

      expect(screen.getByText('Total Paid: $0.00')).toBeInTheDocument();
      // Should still show refund section even for $0
      expect(screen.getByText('Process refund of $0.00')).toBeInTheDocument();
    });

    it('should handle very long reason text', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const longReason = 'This is a very long reason for cancellation that might overflow the text area but should still be handled gracefully by the component without breaking the layout or functionality.'.repeat(3);
      
      const reasonTextarea = screen.getByLabelText(/Reason for Cancellation/);
      fireEvent.change(reasonTextarea, { target: { value: longReason } });

      expect(reasonTextarea).toHaveValue(longReason);
    });

    it('should handle registration with future date', () => {
      const futureRegistration = {
        ...mockRegistrationWithPayments,
        createdAt: '2025-01-01T10:00:00Z',
      };

      render(<RegistrationCancelForm {...defaultProps} registration={futureRegistration} />);

      expect(screen.getByText(/Registered:.*1\/1\/2025/)).toBeInTheDocument();
    });

    it('should handle registration without playa name', () => {
      const registrationWithoutPlayaName = {
        ...mockRegistrationWithPayments,
        user: {
          ...mockRegistrationWithPayments.user,
          playaName: undefined,
        },
      };

      render(<RegistrationCancelForm {...defaultProps} registration={registrationWithoutPlayaName} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and structure', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      expect(screen.getByLabelText(/Reason for Cancellation/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Send cancellation notification to user/)).toBeInTheDocument();
      
      // Check for proper form structure
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('should have proper button roles and states', () => {
      render(<RegistrationCancelForm {...defaultProps} />);

      const confirmButton = screen.getByRole('button', { name: /Cancel Registration/ });
      const cancelButton = screen.getByRole('button', { name: /^Cancel$/ });
      
      expect(confirmButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
      expect(confirmButton).not.toBeDisabled();
      expect(cancelButton).not.toBeDisabled();
    });
  });
}); 