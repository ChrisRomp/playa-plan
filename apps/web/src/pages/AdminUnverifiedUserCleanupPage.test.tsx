import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import AdminUnverifiedUserCleanupPage from './AdminUnverifiedUserCleanupPage';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

describe('AdminUnverifiedUserCleanupPage', () => {
  const candidatePage = {
    users: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'unused-one@example.com',
        firstName: 'Unused',
        lastName: 'One',
        createdAt: '2026-07-01T12:00:00.000Z',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        email: 'unused-two@example.com',
        firstName: 'Unused',
        lastName: 'Two',
        createdAt: '2026-07-02T12:00:00.000Z',
      },
    ],
    total: 2,
    page: 1,
    limit: 100,
    totalPages: 1,
    minimumAgeDays: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: candidatePage });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <AdminUnverifiedUserCleanupPage />
      </MemoryRouter>
    );

  it('should render eligible accounts with creation dates', async () => {
    renderPage();

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(await screen.findByText('Unused One')).toBeInTheDocument();
    expect(screen.getByText('unused-one@example.com')).toBeInTheDocument();
    expect(
      screen.getByText(new Date(candidatePage.users[0].createdAt).toLocaleDateString())
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/users/unverified-cleanup', {
      params: {
        page: 1,
        limit: 100,
      },
    });
  });

  it('should select all visible accounts and require irreversible confirmation', async () => {
    renderPage();
    await screen.findByText('Unused One');

    fireEvent.click(screen.getByLabelText('Select all unused accounts on this page'));
    fireEvent.click(screen.getByRole('button', { name: 'Permanently Remove' }));

    const dialog = screen.getByRole('dialog', {
      name: 'Permanently remove 2 unused accounts?',
    });
    expect(within(dialog).getByText('This operation cannot be undone.')).toBeInTheDocument();
    expect(within(dialog).getByText('unused-one@example.com')).toBeInTheDocument();
    expect(within(dialog).getByText('unused-two@example.com')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should delete selected accounts and report skipped reasons', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        deleted: [candidatePage.users[0]],
        skipped: [
          {
            id: candidatePage.users[1].id,
            reason: 'ALREADY_VERIFIED',
          },
        ],
      },
    });
    renderPage();
    await screen.findByText('Unused One');

    fireEvent.click(screen.getByLabelText('Select all unused accounts on this page'));
    fireEvent.click(screen.getByRole('button', { name: 'Permanently Remove' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Permanently Remove',
      })
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/admin/users/unverified-cleanup/delete', {
        ids: candidatePage.users.map(user => user.id),
      });
    });
    expect(
      await screen.findByText('1 account permanently removed. 1 skipped: email was verified.')
    ).toBeInTheDocument();
  });

  it('should display API errors and allow retrying', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Cleanup unavailable'));
    renderPage();

    expect(await screen.findByText('Cleanup unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });

  it('should close the confirmation dialog and display deletion errors', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Deletion failed'));
    renderPage();
    await screen.findByText('Unused One');

    fireEvent.click(screen.getByLabelText('Select Unused One'));
    fireEvent.click(screen.getByRole('button', { name: 'Permanently Remove' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Permanently Remove',
      })
    );

    expect(await screen.findByText('Deletion failed')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
