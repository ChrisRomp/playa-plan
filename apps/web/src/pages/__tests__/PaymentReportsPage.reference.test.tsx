/**
 * Focused tests for the "Reference ID" table column in PaymentReportsPage.
 *
 * These tests use a DataTable mock that delegates to column `accessor` functions
 * so the rendered output reflects the real column logic.  They live in a
 * separate file to avoid mock-collision with the main test file, which
 * checks summary-stat currency text produced by the same formatCurrency helper
 * that the amount column accessor calls.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentReportsPage } from '../PaymentReportsPage';
import { reports } from '../../lib/api';
import { Payment } from '../../types';
import type { DataTableColumn } from '../../components/common/DataTable/DataTable';

vi.mock('../../lib/api', () => ({
  reports: {
    getPayments: vi.fn(),
  },
}));

vi.mock('../../utils/csv', () => ({
  downloadCsv: vi.fn(),
}));

vi.mock('../../components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// DataTable mock that renders each column's accessor value so we can assert
// on displayed cell content without spinning up the full DataTable component.
vi.mock('../../components/common/DataTable/DataTable', () => ({
  DataTable: ({
    data,
    columns,
  }: {
    data: Payment[];
    columns: DataTableColumn<Payment>[];
    getRowKey: (row: Payment) => string | number;
    emptyMessage?: string;
  }) => (
    <div data-testid="data-table">
      {data.map((item: Payment) => (
        <div key={item.id} data-testid={`payment-${item.id}`}>
          {columns.map(col => (
            <span key={col.id} data-testid={`${item.id}-col-${col.id}`}>
              {String(col.accessor(item) ?? '')}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.spyOn(console, 'error').mockImplementation(() => {});

const basePayment: Payment = {
  id: 'pmt',
  amount: 100,
  currency: 'USD',
  status: 'COMPLETED',
  provider: 'MANUAL',
  providerRefId: null,
  externalPaymentReference: null,
  createdAt: '2025-05-01T10:00:00Z',
  updatedAt: '2025-05-01T10:00:00Z',
  userId: 'u1',
  user: { id: 'u1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
};

const renderComponent = () =>
  render(
    <MemoryRouter>
      <PaymentReportsPage />
    </MemoryRouter>
  );

describe('PaymentReportsPage - Reference ID table column', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display providerRefId when it is present', async () => {
    vi.mocked(reports.getPayments).mockResolvedValue([
      { ...basePayment, providerRefId: 'stripe_abc123' },
    ]);

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('pmt-col-providerRefId')).toBeInTheDocument());

    expect(screen.getByTestId('pmt-col-providerRefId')).toHaveTextContent('stripe_abc123');
  });

  it('should fall back to externalPaymentReference when providerRefId is null', async () => {
    vi.mocked(reports.getPayments).mockResolvedValue([
      { ...basePayment, providerRefId: null, externalPaymentReference: 'CHECK-5555' },
    ]);

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('pmt-col-providerRefId')).toBeInTheDocument());

    expect(screen.getByTestId('pmt-col-providerRefId')).toHaveTextContent('CHECK-5555');
  });

  it('should display N/A when both providerRefId and externalPaymentReference are absent', async () => {
    vi.mocked(reports.getPayments).mockResolvedValue([
      { ...basePayment, providerRefId: null, externalPaymentReference: null },
    ]);

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('pmt-col-providerRefId')).toBeInTheDocument());

    expect(screen.getByTestId('pmt-col-providerRefId')).toHaveTextContent('N/A');
  });

  it('should prefer externalPaymentReference over providerRefId when both are set', async () => {
    vi.mocked(reports.getPayments).mockResolvedValue([
      {
        ...basePayment,
        providerRefId: 'paypal_xyz',
        externalPaymentReference: 'CHECK-9999',
      },
    ]);

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('pmt-col-providerRefId')).toBeInTheDocument());

    expect(screen.getByTestId('pmt-col-providerRefId')).toHaveTextContent('CHECK-9999');
  });
});
