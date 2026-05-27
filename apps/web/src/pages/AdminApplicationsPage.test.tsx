import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminApplicationsPage from './AdminApplicationsPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../store/authUtils', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      isAuthenticated: true,
      isEarlyRegistrationEnabled: false,
      hasRegisteredForCurrentYear: false,
    },
  }),
}));

vi.mock('../components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

vi.mock('../components/admin/ApplicationDetailModal', () => ({
  default: ({ applicationId, isOpen }: { applicationId: string | null; isOpen: boolean }) =>
    isOpen ? <div data-testid="application-detail-modal">{applicationId}</div> : null,
}));

describe('AdminApplicationsPage', () => {
  const mockApplicationList = {
    data: [
      {
        id: 'application-1',
        userId: 'user-1',
        year: 2025,
        status: 'APPLICATION_SUBMITTED',
        createdAt: '2025-02-01T12:00:00.000Z',
        user: {
          id: 'user-1',
          email: 'alex@example.com',
          firstName: 'Alex',
          lastName: 'Applicant',
          playaName: 'Dusty',
        },
        campingOptionRegistrations: [
          {
            id: 'cor-1',
            campingOption: {
              id: 'camp-1',
              name: 'Tent Camping',
            },
          },
        ],
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: mockApplicationList });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <AdminApplicationsPage />
      </MemoryRouter>,
    );

  it('loads submitted applications by default and renders the table', async () => {
    renderPage();

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/admin/applications', {
        params: {
          page: 1,
          limit: 10,
          search: undefined,
          status: 'APPLICATION_SUBMITTED',
        },
      });
    });

    expect(await screen.findByText('Alex Applicant')).toBeInTheDocument();
    expect(screen.getByText('Dusty')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('Tent Camping')).toBeInTheDocument();

    const tableBody = screen.getAllByRole('rowgroup')[1];

    expect(within(tableBody).getAllByRole('row')).toHaveLength(1);
    expect(within(tableBody).getByText('Submitted')).toBeInTheDocument();
  });

  it('approves an individual application from the list', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

    renderPage();

    await screen.findByText('Alex Applicant');

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/applications/application-1/approve', {});
    });

    expect(await screen.findByText('Application approved.')).toBeInTheDocument();
  });

  it('opens the decline dialog and submits a required message', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

    renderPage();

    await screen.findByText('Alex Applicant');

    fireEvent.click(screen.getByText('Decline'));

    expect(screen.getByRole('dialog', { name: 'Decline Application' })).toBeInTheDocument();
    expect(screen.getByText(/This message is sent to the applicant by email\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Decline Application' }));
    expect(await screen.findByText('A decline message is required.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Decline message'), {
      target: { value: 'Please add your vehicle details and resubmit.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Decline Application' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/applications/application-1/decline', {
        message: 'Please add your vehicle details and resubmit.',
      });
    });
  });

  it('supports bulk approval for selected applications', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

    renderPage();

    await screen.findByText('Alex Applicant');

    fireEvent.click(screen.getByLabelText('Select Alex Applicant'));
    fireEvent.click(screen.getByText('Bulk Approve'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/applications/bulk', {
        ids: ['application-1'],
        action: 'approve',
      });
    });

    expect(await screen.findByText('1 application approved.')).toBeInTheDocument();
  });

  it('opens the application detail modal when a row is clicked', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Alex Applicant'));

    expect(screen.getByTestId('application-detail-modal')).toHaveTextContent('application-1');
  });
});
