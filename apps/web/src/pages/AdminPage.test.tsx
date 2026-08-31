import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../routes';
import AdminPage from './AdminPage';

vi.mock('../store/authUtils', () => ({
  useAuth: () => ({
    user: {
      name: 'Admin User',
    },
  }),
}));

describe('AdminPage', () => {
  it('should link to the unverified email cleanup utility', () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Review Unused Accounts →' })).toHaveAttribute(
      'href',
      ROUTES.ADMIN_UNVERIFIED_USER_CLEANUP.path
    );
  });
});
