import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminPaymentsPage } from '../AdminPaymentsPage';
import { reports } from '../../lib/api';
import { adminRegistrationsApi } from '../../lib/api/admin-registrations';
import { Payment } from '../../types';
import { downloadCsv } from '../../utils/csv';

// Mock the api module
vi.mock('../../lib/api', () => ({
  reports: {
    getPayments: vi.fn(),
    recordExternalPayment: vi.fn(),
    processRefund: vi.fn(),
    reconcileRefund: vi.fn(),
  },
}));

vi.mock('../../utils/csv', () => ({
  downloadCsv: vi.fn(),
}));

vi.mock('../../lib/api/admin-registrations', () => ({
  adminRegistrationsApi: {
    getRegistrations: vi.fn(),
    searchExternalPaymentRegistrations: vi.fn(),
  },
}));

vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: {
      currentYear: 2026,
    },
  }),
}));

// Mock the LoadingSpinner component
vi.mock('../../components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// Mock the DataTable component
vi.mock('../../components/common/DataTable/DataTable', () => ({
  DataTable: ({
    data,
    emptyMessage,
    caption,
    columns,
  }: {
    data: Payment[];
    emptyMessage: string;
    caption: string;
    columns: Array<{
      id: string;
      Cell?: (props: { row: Payment }) => ReactNode;
    }>;
  }) => (
    <div data-testid="data-table" aria-label={caption}>
      {data.length === 0 ? (
        <div data-testid="empty-message">{emptyMessage}</div>
      ) : (
        <div>
          {data.map((item: Payment) => (
            <div key={item.id} data-testid={`payment-${item.id}`}>
              {item.id} - {item.status} - ${item.amount}
              {columns.map(column => (
                <div key={column.id}>{column.Cell?.({ row: item })}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  ),
}));

// Mock console.error to prevent test output pollution
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

const mockPayments: Payment[] = [
  {
    id: 'payment1',
    amount: 150, // Corrected amount
    currency: 'USD',
    status: 'COMPLETED',
    provider: 'STRIPE',
    providerRefId: 'stripe_12345',
    processorRefundAvailable: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    userId: 'user1',
    registrationId: 'reg1',
    user: {
      id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    },
  },
  {
    id: 'payment2',
    amount: 200, // Corrected amount
    currency: 'USD',
    status: 'PENDING',
    provider: 'PAYPAL',
    providerRefId: 'paypal_67890',
    createdAt: '2024-01-16T10:00:00Z',
    updatedAt: '2024-01-16T10:00:00Z',
    userId: 'user2',
    registrationId: 'reg2',
    user: {
      id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
    },
  },
  {
    id: 'payment3',
    amount: 100, // Corrected amount
    currency: 'USD',
    status: 'FAILED',
    provider: 'STRIPE',
    providerRefId: 'stripe_54321',
    createdAt: '2024-01-17T10:00:00Z',
    updatedAt: '2024-01-17T10:00:00Z',
    userId: 'user3',
    registrationId: 'reg3',
    user: {
      id: 'user3',
      firstName: 'Mike',
      lastName: 'Johnson',
      email: 'mike@example.com',
    },
  },
  {
    id: 'payment4',
    amount: 75, // Corrected amount
    currency: 'USD',
    status: 'REFUNDED',
    user: {
      id: 'user4',
      firstName: 'Sarah',
      lastName: 'Williams',
      email: 'sarah@example.com',
    },
    provider: 'STRIPE',
    providerRefId: 'stripe_98765',
    createdAt: '2024-01-18T10:00:00Z',
    updatedAt: '2024-01-18T10:00:00Z',
    userId: 'user4',
    registrationId: 'reg4',
  },
];

const mockCurrentYearRegistration = {
  id: 'registration-1',
  year: 2026,
  status: 'CONFIRMED' as const,
  createdAt: '2026-01-15T10:00:00Z',
  user: {
    id: 'user-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    playaName: 'Dusty John',
    role: 'PARTICIPANT',
  },
  jobs: [],
  payments: [],
};

const renderComponent = (initialEntry = '/admin/payments') => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminPaymentsPage />
    </MemoryRouter>
  );
};

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminRegistrationsApi.getRegistrations).mockResolvedValue({
      registrations: [mockCurrentYearRegistration],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
    vi.mocked(adminRegistrationsApi.searchExternalPaymentRegistrations).mockResolvedValue({
      registrations: [mockCurrentYearRegistration],
      total: 1,
      page: 1,
      limit: 8,
      totalPages: 1,
    });
  });

  afterEach(() => {
    mockConsoleError.mockClear();
    mockConsoleLog.mockClear();
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching data', () => {
      // Mock API to never resolve
      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Successful Data Fetching', () => {
    beforeEach(() => {
      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockResolvedValue(mockPayments);
    });

    it('should render the page header correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment Administration')).toBeInTheDocument();
      });

      expect(screen.getByText('Back to Admin')).toBeInTheDocument();
    });

    it('should render action buttons', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('should render the data table with payments', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      expect(screen.getByTestId('payment-payment1')).toBeInTheDocument();
      expect(screen.getByTestId('payment-payment2')).toBeInTheDocument();
      expect(screen.getByTestId('payment-payment3')).toBeInTheDocument();
      expect(screen.getByTestId('payment-payment4')).toBeInTheDocument();
    });

    it('should render summary statistics correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Total Payments')).toBeInTheDocument();
      });

      expect(screen.getByText('4')).toBeInTheDocument(); // Total count
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Refunded / Partial')).toBeInTheDocument();
      expect(screen.getByText('Net Revenue')).toBeInTheDocument();
      expect(screen.getAllByText('$150.00 USD').length).toBeGreaterThan(0);
    });

    it('should call getPayments on mount with empty filters', async () => {
      const mockGetPayments = vi.mocked(reports.getPayments);

      renderComponent();

      await waitFor(() => {
        expect(mockGetPayments).toHaveBeenCalledWith({});
      });
    });

    it('should initialize registration context from URL parameters', async () => {
      renderComponent('/admin/payments?registrationId=registration-1&userId=user-1&year=2026');

      await waitFor(() => {
        expect(reports.getPayments).toHaveBeenCalledWith({
          registrationId: 'registration-1',
          year: 2026,
        });
      });

      fireEvent.click(screen.getByText('Record External Payment'));

      expect(await screen.findByText(/john@example\.com/)).toBeInTheDocument();
      expect(screen.queryByLabelText('User ID')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Registration ID')).not.toBeInTheDocument();
      expect(adminRegistrationsApi.searchExternalPaymentRegistrations).toHaveBeenCalledWith({
        year: 2026,
        registrationId: 'registration-1',
        search: undefined,
        limit: 8,
      });

      fireEvent.click(screen.getByText('Change registration'));

      expect(await screen.findByRole('searchbox', { name: 'Registration' })).toBeInTheDocument();
    });

    it('should clear an unresolvable prefilled registration before a replacement search', async () => {
      vi.mocked(adminRegistrationsApi.searchExternalPaymentRegistrations).mockResolvedValue({
        registrations: [],
        total: 0,
        page: 1,
        limit: 8,
        totalPages: 0,
      });

      renderComponent('/admin/payments?registrationId=stale-registration&userId=stale-user&year=2026');

      fireEvent.click(await screen.findByText('Record External Payment'));

      await waitFor(() => {
        expect(adminRegistrationsApi.searchExternalPaymentRegistrations).toHaveBeenCalledWith({
          year: 2026,
          registrationId: 'stale-registration',
          search: undefined,
          limit: 8,
        });
      });

      fireEvent.change(screen.getByRole('searchbox', { name: 'Registration' }), {
        target: { value: 'jane@example.com' },
      });

      await waitFor(() => {
        expect(adminRegistrationsApi.searchExternalPaymentRegistrations).toHaveBeenLastCalledWith({
          year: 2026,
          registrationId: undefined,
          search: 'jane@example.com',
          limit: 8,
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when API call fails', async () => {
      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockRejectedValue(new Error('API Error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch payments data')).toBeInTheDocument();
      });

      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    it('should retry fetching data when "Try again" is clicked', async () => {
      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockRejectedValueOnce(new Error('API Error'));
      mockGetPayments.mockResolvedValueOnce(mockPayments);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch payments data')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Try again');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockGetPayments).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Filters Functionality', () => {
    beforeEach(() => {
      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockResolvedValue(mockPayments);
    });

    it('should open and close filters panel', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      const filtersButton = screen.getByText('Filters');

      // Initially filters should not be visible
      expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();

      // Open filters
      fireEvent.click(filtersButton);

      // Wait for filters to open
      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Provider')).toBeInTheDocument();
      expect(screen.getByLabelText('Year')).toBeInTheDocument();

      // Close filters
      fireEvent.click(filtersButton);

      await waitFor(() => {
        expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
      });
    });

    it('should apply status filter', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      // Open filters
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });

      // Select status filter
      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'COMPLETED' } });

      // Verify the filter value is set
      expect(statusSelect).toHaveValue('COMPLETED');
    });

    it('should keep the latest payment response when filter requests resolve out of order', async () => {
      let resolvePreviousRequest: (value: Payment[]) => void = () => {};
      const previousRequest = new Promise<Payment[]>(resolve => {
        resolvePreviousRequest = resolve;
      });
      const mockGetPayments = vi
        .mocked(reports.getPayments)
        .mockResolvedValueOnce(mockPayments)
        .mockImplementationOnce(() => previousRequest)
        .mockResolvedValueOnce([mockPayments[1]]);

      renderComponent();
      await screen.findByTestId('payment-payment1');

      fireEvent.click(screen.getByText('Filters'));
      const statusSelect = await screen.findByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'COMPLETED' } });
      await waitFor(() => expect(mockGetPayments).toHaveBeenCalledTimes(2));

      fireEvent.change(statusSelect, { target: { value: 'PENDING' } });
      await waitFor(() => expect(mockGetPayments).toHaveBeenCalledTimes(3));
      await screen.findByTestId('payment-payment2');

      resolvePreviousRequest([mockPayments[0]]);

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment2')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('empty-message')).not.toBeInTheDocument();
    });

    it('should apply provider filter', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      // Open filters
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Provider')).toBeInTheDocument();
      });

      // Select provider filter
      const providerSelect = screen.getByLabelText('Provider');
      fireEvent.change(providerSelect, { target: { value: 'STRIPE' } });

      // Verify the filter value is set
      expect(providerSelect).toHaveValue('STRIPE');
    });

    it('should apply year filter', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      // Open filters
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Year')).toBeInTheDocument();
      });

      // Set year filter
      const yearSelect = screen.getByLabelText('Year');
      fireEvent.change(yearSelect, { target: { value: '2024' } });

      // Verify the filter value is set
      expect(yearSelect).toHaveValue('2024');
    });

    it('should clear all filters', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      // Open filters and set some values
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'COMPLETED' } });

      // Clear filters
      const clearButton = screen.getByText('Clear All');
      fireEvent.click(clearButton);

      // Verify filters are cleared
      expect(statusSelect).toHaveValue('');
    });
  });

  describe('Payment Admin Actions', () => {
    beforeEach(() => {
      vi.mocked(reports.getPayments).mockResolvedValue(mockPayments);
    });

    it('should submit externally recorded payment details', async () => {
      vi.mocked(reports.recordExternalPayment).mockResolvedValue({
        ...mockPayments[0],
        id: 'external-payment',
        provider: 'MANUAL',
        externalPaymentMethod: 'Check',
        externalPaymentReference: 'Check #1234',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Record External Payment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record External Payment'));
      fireEvent.change(await screen.findByLabelText('Registration'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.click(await screen.findByRole('button', { name: /John Doe.*john@example\.com/i }));
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '125.50' } });
      fireEvent.change(screen.getByLabelText('External method'), { target: { value: 'Check' } });
      fireEvent.change(screen.getByLabelText('Reference'), { target: { value: 'Check #1234' } });
      fireEvent.click(screen.getByText('Record payment'));

      await waitFor(() => {
        expect(reports.recordExternalPayment).toHaveBeenCalledWith({
          amount: 125.5,
          currency: 'USD',
          userId: 'user-1',
          registrationId: 'registration-1',
          externalPaymentMethod: 'Check',
          reference: 'Check #1234',
          status: 'COMPLETED',
        });
      });
    });

    it('should submit a partial refund with no registration status change by default', async () => {
      vi.mocked(reports.processRefund).mockResolvedValue({
        paymentId: 'payment1',
        refundAmount: 50,
        providerRefundId: 'refund-1',
        success: true,
        refundStatus: 'SUCCEEDED',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByText('Refund')[0]);
      fireEvent.change(screen.getByLabelText('Refund amount'), { target: { value: '50.00' } });
      fireEvent.change(screen.getByLabelText('Reason'), {
        target: { value: 'Camp fee adjustment' },
      });
      fireEvent.click(screen.getByText('Submit refund'));

      await waitFor(() => {
        expect(reports.processRefund).toHaveBeenCalledWith({
          paymentId: 'payment1',
          amount: 50,
          reason: 'Camp fee adjustment',
          resultingRegistrationStatus: undefined,
        });
      });
    });

    it('should require an explicit refund amount and prominently identify offline refunds', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        {
          ...mockPayments[0],
          provider: 'MANUAL',
        },
      ]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByText('Refund')[0]);

      expect(screen.getByLabelText('Refund amount')).toHaveValue(null);
      expect(
        screen.queryByRole('button', { name: 'Full remaining amount' })
      ).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Manual refund only');
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This refund will be recorded as a manual/offline refund.'
      );
    });

    it('should disable Stripe refunds when processor refunds are unavailable', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        {
          ...mockPayments[0],
          processorRefundAvailable: false,
        },
      ]);

      renderComponent();

      const refundButton = await screen.findByRole('button', { name: 'Refund' });

      expect(refundButton).toBeDisabled();
      expect(refundButton).toHaveAttribute('aria-describedby', 'refund-unavailable-payment1');
      expect(screen.getByText('Stripe refunds are unavailable for this payment.')).toBeInTheDocument();
    });

    it('should not show a Reconcile action when there is no pending processor refund', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment1')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Reconcile/ })).not.toBeInTheDocument();
    });

    it('should show a Reconcile action for a Stripe payment with a pending processor refund', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        {
          ...mockPayments[0],
          refunds: [
            {
              id: 'refund-1',
              paymentId: 'payment1',
              amountCents: 15000,
              currency: 'USD',
              status: 'PENDING',
              processorRefund: true,
              createdAt: '2024-01-15T10:00:00Z',
              updatedAt: '2024-01-15T10:00:00Z',
            },
          ],
        },
      ]);

      renderComponent();

      expect(await screen.findByRole('button', { name: 'Reconcile' })).toBeInTheDocument();
    });

    it('should reconcile a pending refund and refresh the payment list', async () => {
      const pendingPayment: Payment = {
        ...mockPayments[0],
        refunds: [
          {
            id: 'refund-1',
            paymentId: 'payment1',
            amountCents: 15000,
            currency: 'USD',
            status: 'PENDING',
            processorRefund: true,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
          },
        ],
      };
      vi.mocked(reports.getPayments).mockResolvedValue([pendingPayment]);
      vi.mocked(reports.reconcileRefund).mockResolvedValue({
        payment: { ...pendingPayment, refunds: [] },
        reconciledRefundIds: ['refund-1'],
      });

      renderComponent();

      const reconcileButton = await screen.findByRole('button', { name: 'Reconcile' });
      fireEvent.click(reconcileButton);

      await waitFor(() => {
        expect(reports.reconcileRefund).toHaveBeenCalledWith('payment1');
      });
      await waitFor(() => {
        expect(reports.getPayments).toHaveBeenCalledTimes(2);
      });
    });

    it('should surface an error when reconciling a pending refund fails', async () => {
      const pendingPayment: Payment = {
        ...mockPayments[0],
        refunds: [
          {
            id: 'refund-1',
            paymentId: 'payment1',
            amountCents: 15000,
            currency: 'USD',
            status: 'PENDING',
            processorRefund: true,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
          },
        ],
      };
      vi.mocked(reports.getPayments).mockResolvedValue([pendingPayment]);
      vi.mocked(reports.reconcileRefund).mockRejectedValue(new Error('Reconcile failed'));

      renderComponent();

      const reconcileButton = await screen.findByRole('button', { name: 'Reconcile' });
      fireEvent.click(reconcileButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to reconcile pending refund')).toBeInTheDocument();
      });
    });

    it('should submit an explicit registration status change with a refund', async () => {
      vi.mocked(reports.processRefund).mockResolvedValue({
        paymentId: 'payment1',
        refundAmount: 150,
        providerRefundId: 'refund-1',
        success: true,
        refundStatus: 'SUCCEEDED',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByText('Refund')[0]);
      fireEvent.change(screen.getByLabelText('Refund amount'), { target: { value: '150.00' } });
      fireEvent.change(screen.getByLabelText('Registration status change'), {
        target: { value: 'WAITLISTED' },
      });
      fireEvent.change(screen.getByLabelText('Reason'), {
        target: { value: 'Move registration to waitlist' },
      });
      fireEvent.click(screen.getByText('Submit refund'));

      await waitFor(() => {
        expect(reports.processRefund).toHaveBeenCalledWith({
          paymentId: 'payment1',
          amount: 150,
          reason: 'Move registration to waitlist',
          resultingRegistrationStatus: 'WAITLISTED',
        });
      });
    });

    it('should hide registration status changes for an unlinked payment', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        {
          ...mockPayments[0],
          registrationId: null,
        },
      ]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Refund' }));

      expect(screen.queryByLabelText('Registration status change')).not.toBeInTheDocument();
    });

    it('should only offer post-application registration statuses in the refund status dropdown', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByText('Refund')[0]);

      const statusSelect = screen.getByLabelText('Registration status change') as HTMLSelectElement;
      const optionValues = Array.from(statusSelect.options).map(option => option.value);

      expect(optionValues).toEqual(['', 'PENDING', 'CONFIRMED', 'WAITLISTED']);
      expect(optionValues).not.toContain('APPLICATION_SUBMITTED');
      expect(optionValues).not.toContain('APPLICATION_APPROVED');
      expect(optionValues).not.toContain('APPLICATION_DECLINED');
      expect(optionValues).not.toContain('CANCELLED');
    });

    it('should disable PayPal refunds with an explanation', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        {
          ...mockPayments[1],
          status: 'COMPLETED',
        },
      ]);

      renderComponent();

      const refundButton = await screen.findByRole('button', { name: 'Refund' });

      expect(refundButton).toBeDisabled();
      expect(refundButton).toHaveAttribute('aria-describedby', 'refund-unavailable-payment2');
      expect(
        screen.getByText('PayPal refunds must be handled outside PlayaPlan.')
      ).toBeInTheDocument();
    });

    it('should display gross, refunded, net, and refundable amounts', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        {
          ...mockPayments[0],
          provider: 'MANUAL',
          status: 'PARTIALLY_REFUNDED',
          refundedAmount: 25,
          netAmount: 125,
          refundableAmount: 125,
          externalPaymentMethod: 'Check',
          externalPaymentReference: 'Check #1234',
        },
      ]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('$150.00 USD').length).toBeGreaterThan(0);
      });
      expect(screen.getByText('Refunded $25.00 USD')).toBeInTheDocument();
      expect(screen.getByText('Net $125.00 USD')).toBeInTheDocument();
      expect(screen.getAllByText('$125.00 USD')).toHaveLength(2);
      expect(screen.getByText('External')).toBeInTheDocument();
      expect(screen.getByText('Check #1234')).toBeInTheDocument();
    });

    it('should show an error when refund processing returns an unsuccessful result', async () => {
      vi.mocked(reports.processRefund).mockResolvedValue({
        paymentId: 'payment1',
        refundAmount: 50,
        providerRefundId: 'refund-1',
        success: false,
        refundStatus: 'FAILED',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByText('Refund')[0]);
      fireEvent.change(screen.getByLabelText('Refund amount'), { target: { value: '50.00' } });
      fireEvent.click(screen.getByText('Submit refund'));

      await waitFor(() => {
        expect(screen.getByText('Failed to process refund')).toBeInTheDocument();
      });
      expect(screen.getByText('Submit refund')).toBeInTheDocument();
    });

    it('should close the refund form when refund processing is pending processor confirmation', async () => {
      const pendingPayment: Payment = {
        ...mockPayments[0],
        status: 'PARTIALLY_REFUNDED',
        refundedAmount: 25,
        netAmount: 125,
        refundableAmount: 0,
        processorRefundAvailable: false,
        refunds: [
          {
            id: 'succeeded-refund',
            paymentId: 'payment1',
            amountCents: 2500,
            currency: 'USD',
            status: 'SUCCEEDED',
            processorRefund: true,
            processedByUserId: 'admin1',
            createdAt: '2024-01-16T10:00:00Z',
            updatedAt: '2024-01-16T10:00:00Z',
          },
          {
            id: 'pending-refund',
            paymentId: 'payment1',
            amountCents: 12500,
            currency: 'USD',
            status: 'PENDING',
            processorRefund: true,
            processedByUserId: 'admin1',
            createdAt: '2024-01-17T10:00:00Z',
            updatedAt: '2024-01-17T10:00:00Z',
          },
        ],
      };
      vi.mocked(reports.getPayments)
        .mockResolvedValueOnce([mockPayments[0]])
        .mockResolvedValueOnce([pendingPayment]);
      vi.mocked(reports.processRefund).mockResolvedValue({
        paymentId: 'payment1',
        refundAmount: 125,
        providerRefundId: 'refund-1',
        success: false,
        refundStatus: 'PENDING',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByText('Refund')[0]);
      fireEvent.change(screen.getByLabelText('Refund amount'), { target: { value: '125.00' } });
      fireEvent.click(screen.getByText('Submit refund'));

      await waitFor(() => {
        expect(screen.getByText('REFUND PENDING')).toBeInTheDocument();
      });
      expect(screen.queryByText('Submit refund')).not.toBeInTheDocument();
      expect(screen.queryByText('Failed to process refund')).not.toBeInTheDocument();
      expect(screen.getByText('Pending refund $125.00 USD')).toBeInTheDocument();
      expect(screen.getByText('Refunded $25.00 USD')).toBeInTheDocument();
      expect(screen.getByText('Net $125.00 USD')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Refund' })).toBeDisabled();
      expect(
        screen.getByText(
          'A refund of $125.00 USD is pending Stripe confirmation and has reserved the remaining balance.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('CSV Export Functionality', () => {
    it('should export payment and refund details for the filtered rows', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        {
          ...mockPayments[0],
          provider: 'MANUAL',
          status: 'PARTIALLY_REFUNDED',
          refundedAmount: 25,
          netAmount: 125,
          refundableAmount: 125,
          externalPaymentMethod: 'Check',
          externalPaymentReference: 'Check #1234',
        },
      ]);

      renderComponent('/admin/payments?registrationId=reg1&year=2024');

      fireEvent.click(await screen.findByRole('button', { name: 'Export payments data' }));

      expect(downloadCsv).toHaveBeenCalledWith(
        [
          'Name',
          'Date/Time',
          'Amount',
          'Refunded',
          'Net Amount',
          'Refundable',
          'Status',
          'Source',
          'External Method',
          'External Reference',
          'Registration ID',
        ],
        [
          [
            'John Doe',
            expect.any(String),
            '$150.00 USD',
            '$25.00 USD',
            '$125.00 USD',
            '$125.00 USD',
            'PARTIALLY_REFUNDED',
            'External',
            'Check',
            'Check #1234',
            'reg1',
          ],
        ],
        {
          filename: expect.stringMatching(
            /^payment_reports_registrationId-reg1_year-2024_\d{4}-\d{2}-\d{2}\.csv$/
          ),
        }
      );
    });

    it('should export amounts in each payment currency', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        {
          ...mockPayments[0],
          currency: 'EUR',
          amount: 85.5,
        },
      ]);

      renderComponent();

      fireEvent.click(await screen.findByRole('button', { name: 'Export payments data' }));

      expect(downloadCsv).toHaveBeenCalledWith(
        expect.any(Array),
        [
          [
            'John Doe',
            expect.any(String),
            '€85.50 EUR',
            '€0.00 EUR',
            '€85.50 EUR',
            '€85.50 EUR',
            'COMPLETED',
            'STRIPE',
            'N/A',
            'stripe_12345',
            'reg1',
          ],
        ],
        expect.any(Object)
      );
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no payments found', async () => {
      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('No payments found')).toBeInTheDocument();
      });

      // Should not render the data table when there are no payments
      expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
    });

    it('should show zero counts in summary when no payments', async () => {
      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Total Payments')).toBeInTheDocument();
      });

      expect(screen.getByText('Total Payments')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Refunded / Partial')).toBeInTheDocument();
      expect(screen.getByText('Net Revenue')).toBeInTheDocument();
      expect(screen.getByText('$0.00 USD')).toBeInTheDocument();
    });
  });

  describe('Data Validation', () => {
    it('should handle payments with missing optional fields', async () => {
      const paymentsWithMissingFields: Payment[] = [
        {
          id: 'payment-minimal',
          amount: 100, // Corrected amount
          currency: 'USD',
          status: 'COMPLETED',
          provider: 'STRIPE',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
          userId: 'user1',
          user: {
            id: 'user1',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
          // Missing optional fields: providerRefId, registrationId
        },
      ];

      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockResolvedValue(paymentsWithMissingFields);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment-minimal')).toBeInTheDocument();
      });

      // Should still render correctly without optional fields
      expect(screen.getByText('Total Payments')).toBeInTheDocument();

      // Check that the total count shows 1 payment
      const totalPaymentsCards = screen.getAllByText('1');
      expect(totalPaymentsCards.length).toBeGreaterThan(0);
    });

    it('should group net revenue and format amounts by currency', async () => {
      const paymentsWithDifferentCurrencies: Payment[] = [
        mockPayments[0],
        {
          id: 'payment-eur',
          amount: 85.5, // Corrected amount
          currency: 'EUR',
          status: 'COMPLETED',
          provider: 'STRIPE',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
          userId: 'user1',
          user: {
            id: 'user1',
            firstName: 'Euro',
            lastName: 'User',
            email: 'euro@example.com',
          },
        },
      ];

      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockResolvedValue(paymentsWithDifferentCurrencies);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment-eur')).toBeInTheDocument();
      });

      expect(screen.getByText('Net Revenue')).toBeInTheDocument();
      expect(screen.getAllByText('$150.00 USD').length).toBeGreaterThan(0);
      expect(screen.getAllByText('€85.50 EUR').length).toBeGreaterThan(0);
    });
  });
});
