import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationDetailModal from './ApplicationDetailModal';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
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

  const mockNotes = [
    {
      id: 'note-1',
      content: 'Returning camper from 2023',
      createdAt: '2025-01-15T08:00:00.000Z',
      author: { id: 'staff-1', email: 'staff@example.com', firstName: 'Sam', lastName: 'Staff' },
    },
  ];

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
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockSubmittedApplication })
      .mockResolvedValueOnce({ data: mockNotes });

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
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Decline')).toBeInTheDocument();
  });

  it('shows review summary and hides actions for reviewed applications', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockReviewedApplication })
      .mockResolvedValueOnce({ data: [] });

    render(<ApplicationDetailModal {...defaultProps} />);

    expect(await screen.findByText('Review Summary')).toBeInTheDocument();
    expect(screen.getByText('Avery Admin')).toBeInTheDocument();
    expect(screen.getByText('Welcome to camp.')).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Decline')).not.toBeInTheDocument();
  });

  it('approves an application with an optional message', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockSubmittedApplication })
      .mockResolvedValueOnce({ data: [] });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

    render(<ApplicationDetailModal {...defaultProps} />);

    await screen.findByText('Alex Applicant');

    fireEvent.change(screen.getByLabelText(/Decision Message/), {
      target: { value: 'See you at build week.' },
    });
    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/applications/application-1/approve', {
        message: 'See you at build week.',
      });
    });

    expect(defaultProps.onActionComplete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('requires a message before declining an application', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockSubmittedApplication })
      .mockResolvedValueOnce({ data: [] });

    render(<ApplicationDetailModal {...defaultProps} />);

    await screen.findByText('Alex Applicant');

    fireEvent.click(screen.getByText('Decline'));

    expect(await screen.findByText('A message is required when declining an application.')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('declines an application when a message is provided', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockSubmittedApplication })
      .mockResolvedValueOnce({ data: [] });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

    render(<ApplicationDetailModal {...defaultProps} />);

    await screen.findByText('Alex Applicant');

    fireEvent.change(screen.getByLabelText(/Decision Message/), {
      target: { value: 'We need more information before approving this application.' },
    });
    fireEvent.click(screen.getByText('Decline'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/admin/applications/application-1/decline', {
        message: 'We need more information before approving this application.',
      });
    });

    expect(defaultProps.onActionComplete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('displays staff notes for the applicant', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockSubmittedApplication })
      .mockResolvedValueOnce({ data: mockNotes });

    render(<ApplicationDetailModal {...defaultProps} />);

    expect(await screen.findByText('Staff Notes')).toBeInTheDocument();
    expect(await screen.findByText('Returning camper from 2023')).toBeInTheDocument();
    expect(screen.getByText(/Sam Staff/)).toBeInTheDocument();
  });

  it('fetches notes from the user notes endpoint', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockSubmittedApplication })
      .mockResolvedValueOnce({ data: [] });

    render(<ApplicationDetailModal {...defaultProps} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/users/user-1/notes');
    });
  });

  it('adds a new staff note', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockSubmittedApplication })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: mockNotes });
    vi.mocked(api.post).mockResolvedValueOnce({ data: mockNotes[0] });

    render(<ApplicationDetailModal {...defaultProps} />);

    await screen.findByText('Alex Applicant');

    const noteInput = screen.getByPlaceholderText('Add a staff note...');
    fireEvent.change(noteInput, { target: { value: 'New note about this person' } });
    fireEvent.click(screen.getByText('Add Note'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users/user-1/notes', { content: 'New note about this person' });
    });
  });
});
