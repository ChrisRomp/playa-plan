import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaymentReportsPage } from '../PaymentReportsPage';
import { reports } from '../../lib/api';
import { downloadCsv } from '../../utils/csv';
import { Payment } from '../../types';

// Mock the api module
vi.mock('../../lib/api', () => ({
  reports: {
    getPayments: vi.fn(),
  },
}));

// Mock the csv download utility so tests can inspect what gets exported
vi.mock('../../utils/csv', () => ({
  downloadCsv: vi.fn(),
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
  }: {
    data: Payment[];
    emptyMessage: string;
    caption: string;
  }) => (
    <div data-testid="data-table" aria-label={caption}>
      {data.length === 0 ? (
        <div data-testid="empty-message">{emptyMessage}</div>
      ) : (
        <div>
          {data.map((item: Payment) => (
            <div key={item.id} data-testid={`payment-${item.id}`}>
              {item.id} - {item.status} - ${item.amount}
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

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <PaymentReportsPage />
    </MemoryRouter>
  );
};

describe('PaymentReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        expect(screen.getByText('Payment Reports')).toBeInTheDocument();
      });

      expect(screen.getByText('Back to Reports')).toBeInTheDocument();
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
      expect(screen.getByText('Refunded')).toBeInTheDocument();
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('$150.00 USD')).toBeInTheDocument();
    });

    it('should include partially refunded payments in total revenue', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        mockPayments[0],
        {
          ...mockPayments[3],
          id: 'payment-partial',
          amount: 75,
          status: 'PARTIALLY_REFUNDED',
          refundedAmount: 25,
          netAmount: 50,
        },
      ]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('$200.00 USD')).toBeInTheDocument();
      });
      expect(screen.getByText('Refunded').parentElement).toHaveTextContent('Refunded / Partial: 1');
    });

    it('should call getPayments on mount with empty filters', async () => {
      const mockGetPayments = vi.mocked(reports.getPayments);

      renderComponent();

      await waitFor(() => {
        expect(mockGetPayments).toHaveBeenCalledWith();
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
      expect(screen.getByRole('option', { name: 'Partially Refunded' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'External' })).toBeInTheDocument();

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

  describe('CSV Export Functionality', () => {
    let originalURL: typeof window.URL;
    let originalCreateElement: typeof document.createElement;
    let originalAppendChild: typeof document.body.appendChild;
    let originalRemoveChild: typeof document.body.removeChild;

    beforeEach(() => {
      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockResolvedValue(mockPayments);

      // Save original implementations before each test
      originalURL = window.URL;
      originalCreateElement = document.createElement;
      originalAppendChild = document.body.appendChild;
      originalRemoveChild = document.body.removeChild;
    });

    afterEach(() => {
      // Always restore original implementations after each test
      Object.defineProperty(window, 'URL', {
        value: originalURL,
        writable: true,
        configurable: true,
      });
      document.createElement = originalCreateElement;
      document.body.appendChild = originalAppendChild;
      document.body.removeChild = originalRemoveChild;
    });

    it.skip('should export CSV when export button is clicked', async () => {
      // Mock URL API with a simple implementation that doesn't interfere with testing
      const mockCreateObjectURL = vi.fn(() => 'mock-url');
      const mockRevokeObjectURL = vi.fn();

      // Create a minimal mock anchor that doesn't interfere with DOM
      const mockClick = vi.fn();
      const mockSetAttribute = vi.fn();

      // Store original URL to restore later
      const originalCreateObjectURL = window.URL.createObjectURL;
      const originalRevokeObjectURL = window.URL.revokeObjectURL;

      // Mock only what we need without breaking the DOM
      window.URL.createObjectURL = mockCreateObjectURL;
      window.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock createElement for anchor element only
      const originalCreateElement = document.createElement;
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          const mockElement = {
            click: mockClick,
            setAttribute: mockSetAttribute,
            style: {},
          } as unknown as HTMLAnchorElement;

          // Mock appendChild and removeChild to just track calls
          vi.spyOn(document.body, 'appendChild').mockImplementationOnce(() => mockElement);
          vi.spyOn(document.body, 'removeChild').mockImplementationOnce(() => mockElement);

          return mockElement;
        }
        return originalCreateElement.call(document, tagName);
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      // Verify that the export process was initiated
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-url');
      expect(mockSetAttribute).toHaveBeenCalledWith(
        'download',
        expect.stringMatching(/^payment_reports_\d{4}-\d{2}-\d{2}\.csv$/)
      );

      // Restore original implementations
      window.URL.createObjectURL = originalCreateObjectURL;
      window.URL.revokeObjectURL = originalRevokeObjectURL;
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
      expect(screen.getByText('Refunded')).toBeInTheDocument();
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
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

    it('should handle different currency formats', async () => {
      const paymentsWithDifferentCurrencies: Payment[] = [
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

      // Net revenue is grouped and formatted per currency rather than summed as dollars
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('€85.50 EUR')).toBeInTheDocument();
    });

    it('should group total revenue by currency instead of summing unlike currencies', async () => {
      const paymentsWithMixedCurrencies: Payment[] = [
        {
          id: 'payment-usd',
          amount: 150,
          currency: 'USD',
          status: 'COMPLETED',
          provider: 'STRIPE',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
          userId: 'user1',
          user: { id: 'user1', firstName: 'Dollar', lastName: 'User', email: 'usd@example.com' },
        },
        {
          id: 'payment-eur',
          amount: 85.5,
          currency: 'EUR',
          status: 'COMPLETED',
          provider: 'STRIPE',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
          userId: 'user2',
          user: { id: 'user2', firstName: 'Euro', lastName: 'User', email: 'eur@example.com' },
        },
      ];

      const mockGetPayments = vi.mocked(reports.getPayments);
      mockGetPayments.mockResolvedValue(paymentsWithMixedCurrencies);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('payment-payment-usd')).toBeInTheDocument();
      });

      // Each currency's total should be shown separately, not combined into a single figure
      expect(screen.getByText('$150.00 USD')).toBeInTheDocument();
      expect(screen.getByText('€85.50 EUR')).toBeInTheDocument();
      expect(screen.queryByText('$235.50')).not.toBeInTheDocument();
    });
  });

  describe('Year Filter - Registration Year', () => {
    // Payment recorded in 2026 but linked to a 2025 registration
    const paymentForPriorYear: Payment = {
      id: 'payment-prior-year',
      amount: 300,
      currency: 'USD',
      status: 'COMPLETED',
      provider: 'STRIPE',
      providerRefId: 'stripe_prior',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: '2026-01-10T10:00:00Z',
      userId: 'user-a',
      registrationId: 'reg-2025',
      registration: { id: 'reg-2025', year: 2025 },
      user: { id: 'user-a', firstName: 'Alice', lastName: 'Prior', email: 'alice@example.com' },
    };

    // Payment with no linked registration — must fall back to createdAt year (2026)
    const paymentNoRegistration: Payment = {
      id: 'payment-no-reg',
      amount: 400,
      currency: 'USD',
      status: 'COMPLETED',
      provider: 'MANUAL',
      createdAt: '2026-01-01T00:30:00Z',
      updatedAt: '2026-01-01T00:30:00Z',
      userId: 'user-b',
      registration: null,
      user: { id: 'user-b', firstName: 'Bob', lastName: 'Noreg', email: 'bob@example.com' },
    };

    beforeEach(() => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        paymentForPriorYear,
        paymentNoRegistration,
      ]);
    });

    it('should populate year dropdown from registration.year, not createdAt', async () => {
      renderComponent();

      await waitFor(() => expect(screen.getByText('Payment Reports')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Filters'));
      await waitFor(() => expect(screen.getByLabelText('Year')).toBeInTheDocument());

      const yearSelect = screen.getByLabelText('Year');
      // 2025 comes from registration.year; 2026 comes from the timestamp fallback
      expect(yearSelect).toContainElement(screen.getByRole('option', { name: '2025' }));
      expect(yearSelect).toContainElement(screen.getByRole('option', { name: '2026' }));
      // 2026 must NOT appear as the year for the payment linked to a 2025 registration
      expect(screen.getAllByRole('option', { name: '2026' })).toHaveLength(1);
    });

    it('should filter by registration.year when available', async () => {
      renderComponent();

      await waitFor(() => expect(screen.getByTestId('data-table')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Filters'));
      await waitFor(() => expect(screen.getByLabelText('Year')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2025' } });

      // Only the payment linked to a 2025 registration should remain
      expect(screen.getByTestId('payment-payment-prior-year')).toBeInTheDocument();
      expect(screen.queryByTestId('payment-payment-no-reg')).not.toBeInTheDocument();
    });

    it('should fall back to createdAt year when registration is absent', async () => {
      const getFullYearSpy = vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2025);
      renderComponent();

      await waitFor(() => expect(screen.getByTestId('data-table')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Filters'));
      await waitFor(() => expect(screen.getByLabelText('Year')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2026' } });

      // Only the no-registration payment (createdAt in 2026) should remain
      expect(screen.getByTestId('payment-payment-no-reg')).toBeInTheDocument();
      expect(screen.queryByTestId('payment-payment-prior-year')).not.toBeInTheDocument();
      getFullYearSpy.mockRestore();
    });
  });

  describe('CSV Export - External Payment Reference', () => {
    const manualPayment: Payment = {
      id: 'payment-manual',
      amount: 250,
      currency: 'USD',
      status: 'COMPLETED',
      provider: 'MANUAL',
      providerRefId: null,
      externalPaymentReference: 'CHECK-9876',
      createdAt: '2025-06-01T10:00:00Z',
      updatedAt: '2025-06-01T10:00:00Z',
      userId: 'user-c',
      user: { id: 'user-c', firstName: 'Carol', lastName: 'Cash', email: 'carol@example.com' },
    };

    beforeEach(() => {
      vi.mocked(reports.getPayments).mockResolvedValue([manualPayment]);
      vi.mocked(downloadCsv).mockClear();
    });

    it('should export externalPaymentReference in Reference ID column when providerRefId is null', async () => {
      renderComponent();

      await waitFor(() => expect(screen.getByText('Export')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Export'));

      expect(downloadCsv).toHaveBeenCalledOnce();

      const [, rows] = vi.mocked(downloadCsv).mock.calls[0];
      // Reference ID is the 6th field (index 5) in every data row
      expect(rows[0][5]).toBe('CHECK-9876');
    });

    it('should prefer externalPaymentReference when both references are present', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        { ...manualPayment, providerRefId: 'stripe_abc', externalPaymentReference: 'CHECK-9876' },
      ]);

      renderComponent();

      await waitFor(() => expect(screen.getByText('Export')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Export'));

      expect(downloadCsv).toHaveBeenCalledOnce();

      const [, rows] = vi.mocked(downloadCsv).mock.calls[0];
      expect(rows[0][5]).toBe('CHECK-9876');
    });

    it('should export N/A when both providerRefId and externalPaymentReference are absent', async () => {
      vi.mocked(reports.getPayments).mockResolvedValue([
        { ...manualPayment, providerRefId: null, externalPaymentReference: null },
      ]);

      renderComponent();

      await waitFor(() => expect(screen.getByText('Export')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Export'));

      expect(downloadCsv).toHaveBeenCalledOnce();

      const [, rows] = vi.mocked(downloadCsv).mock.calls[0];
      expect(rows[0][5]).toBe('N/A');
    });
  });
});
