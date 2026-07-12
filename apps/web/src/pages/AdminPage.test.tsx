import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdminPage from './AdminPage';

vi.mock('../store/authUtils', () => ({
  useAuth: () => ({
    user: {
      name: 'Admin User',
    },
  }),
}));

describe('AdminPage', () => {
  it('should navigate to payment administration', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/payments" element={<div>Payment administration</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: /manage payments/i }));

    expect(screen.getByText('Payment administration')).toBeInTheDocument();
  });
});
