import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationDetailModal from './ApplicationDetailModal';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

describe('ApplicationDetailModal', () => {
  const mockSubmittedApplication = {
    id: 'application-1',
    userId: 'user-1',
    year: 2025,
    status: 'APPLICATION_SUBMITTED',
    createdAt: '2025-02-01T12:00:00.000Z',
    reviewedAt: null,
    decisionMessage: null,
    user: {
      id: 'user-1',
      email: 'applicant@example.com',
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
          description: 'Bring your own tent',
        },
        fieldValues: [
          {
            id: 'field-value-1',
            value: 'Blue shade structure',
            field: {
              id: 'field-1',
              displayName: 'Shade Structure',
            },
          },
        ],
      },
    ],
  };

  const mockReviewedApplication = {
    ...mockSubmittedApplication,
    status: 'APPLICATION_APPROVED',
    reviewedAt: '2025-02-03T09:15:00.000Z',
    decisionMessage: 'Welcome to camp.',
    reviewedBy: {
      id: 'reviewer-1',
      email: 'admin@example.com',
      firstName: 'Avery',
      lastName: 'Admin',
      playaName: 'Clipboard',
    },
  };

  const defaultProps = {
    applicationId: 'application-1',
    isOpen: true,
    onClose: vi.fn(),
    onActionComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and renders application detail when opened', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockSubmittedApplication });

    render(<ApplicationDetailModal {...defaultProps} />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/admin/applications/application-1');
    });

    expect(await screen.findByText('Alex Applicant')).toBeInTheDocument();
    expect(screen.getByText('Dusty')).toBeInTheDocument();
    expect(screen.getByText('Tent Camping')).toBeInTheDocument();
    expect(screen.getByText('Shade Structure')).toBeInTheDocument();
    expect(screen.getByText('Blue shade structure')).toBeInTheDocument();
    expect(screen.getByText('Approve Application')).toBeInTheDocument();
    expect(screen.getByText('Decline Application')).toBeInTheDocument();
  });

  it('shows review summary and hides actions for reviewed applications', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockReviewedApplication });

    render(<ApplicationDetailModal {...defaultProps} />);

    expect(await screen.findByText('Review Summary')).toBeInTheDocument();
    expect(screen.getByText('Avery Admin')).toBeInTheDocument();
    expect(screen.getByText('Welcome to camp.')).toBeInTheDocument();
    expect(screen.queryByText('Approve Application')).not.toBeInTheDocument();
    expect(screen.queryByText('Decline Application')).not.toBeInTheDocument();
  });

  it('approves an application with an optional message', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockSubmittedApplication });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

    render(<ApplicationDetailModal {...defaultProps} />);

    await screen.findByText('Alex Applicant');

    fireEvent.change(screen.getByLabelText('Approval Message (optional)'), {
      target: { value: 'See you at build week.' },
    });
    fireEvent.click(screen.getByText('Approve Application'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/applications/application-1/approve', {
        message: 'See you at build week.',
      });
    });

    expect(defaultProps.onActionComplete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('requires a message before declining an application', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockSubmittedApplication });

    render(<ApplicationDetailModal {...defaultProps} />);

    await screen.findByText('Alex Applicant');

    fireEvent.click(screen.getByText('Decline Application'));

    expect(await screen.findByText('A decline message is required.')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('declines an application when a message is provided', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockSubmittedApplication });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

    render(<ApplicationDetailModal {...defaultProps} />);

    await screen.findByText('Alex Applicant');

    fireEvent.change(screen.getByLabelText('Decline Message (required)'), {
      target: { value: 'We need more information before approving this application.' },
    });
    fireEvent.click(screen.getByText('Decline Application'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/applications/application-1/decline', {
        message: 'We need more information before approving this application.',
      });
    });

    expect(defaultProps.onActionComplete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
