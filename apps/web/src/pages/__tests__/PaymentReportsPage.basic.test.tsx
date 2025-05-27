import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaymentReportsPage } from '../PaymentReportsPage';

// Mock just the API
vi.mock('../../lib/api', () => ({
  reports: {
    getPayments: vi.fn(() => Promise.resolve([])),
  },
}));

// Simple test to check if the component renders
describe('PaymentReportsPage - Basic Render Test', () => {
  it('should render PaymentReportsPage component', async () => {
    render(
      <MemoryRouter>
        <PaymentReportsPage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Payment Reports')).toBeInTheDocument();
    });
  });
});
