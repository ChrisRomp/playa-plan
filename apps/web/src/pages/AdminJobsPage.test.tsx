import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useJobCategories } from '../hooks/useJobCategories';
import { useJobs } from '../hooks/useJobs';
import { useShifts } from '../hooks/useShifts';
import AdminJobsPage from './AdminJobsPage';

vi.mock('../hooks/useJobs');
vi.mock('../hooks/useJobCategories');
vi.mock('../hooks/useShifts');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const mockUpdateJob = vi.fn();
const mockDeleteJob = vi.fn();
const mockJobs = [
  {
    id: 'active-job',
    name: 'Active Job',
    location: 'Gate',
    categoryId: 'category-1',
    shiftId: 'shift-1',
    maxRegistrations: 5,
    active: true,
  },
  {
    id: 'inactive-job',
    name: 'Inactive Job',
    location: 'Kitchen',
    categoryId: 'category-1',
    shiftId: 'shift-1',
    maxRegistrations: 5,
    active: false,
  },
];
const mockActiveJobs = mockJobs.filter((job) => job.active);

describe('AdminJobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useJobs as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (includeInactive: boolean) => ({
        jobs: includeInactive ? mockJobs : mockActiveJobs,
        loading: false,
        error: null,
        fetchJobs: vi.fn(),
        createJob: vi.fn(),
        updateJob: mockUpdateJob,
        deleteJob: mockDeleteJob,
      }),
    );
    (useJobCategories as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      categories: [
        {
          id: 'category-1',
          name: 'Operations',
          staffOnly: false,
          alwaysRequired: false,
        },
      ],
      loading: false,
    });
    (useShifts as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      shifts: [
        {
          id: 'shift-1',
          name: 'Morning',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '12:00',
        },
      ],
      loading: false,
    });
  });

  it('requests and renders only active jobs by default', async () => {
    render(<AdminJobsPage />, { wrapper: MemoryRouter });

    await waitFor(() => expect(screen.getByText('Active Job')).toBeInTheDocument());
    expect(useJobs).toHaveBeenCalledWith(false);
    const activeRow = screen.getByText('Active Job').closest('tr');
    expect(activeRow).not.toBeNull();
    expect(within(activeRow!).getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('Inactive Job')).not.toBeInTheDocument();
  });

  it('requests inactive jobs when the visibility control is enabled', () => {
    render(<AdminJobsPage />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByLabelText('Show inactive jobs'));

    expect(useJobs).toHaveBeenLastCalledWith(true);
  });

  it('allows an administrator to reactivate an inactive job', async () => {
    render(<AdminJobsPage />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByLabelText('Show inactive jobs'));
    await waitFor(() => expect(screen.getByText('Inactive Job')).toBeInTheDocument());
    const inactiveRow = screen.getByText('Inactive Job').closest('tr');
    expect(inactiveRow).not.toBeNull();

    fireEvent.click(within(inactiveRow!).getByText('Edit'));
    const activeCheckbox = screen.getByLabelText(
      'Active and available for new registrations',
    );
    expect(activeCheckbox).not.toBeChecked();
    fireEvent.click(activeCheckbox);
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockUpdateJob).toHaveBeenCalledWith(
        'inactive-job',
        expect.objectContaining({ active: true }),
      );
    });
  });

  it('shows the actionable deletion failure', async () => {
    mockDeleteJob.mockRejectedValue(
      new Error('Cannot delete this job because it has historical registrations. Deactivate it instead.'),
    );
    render(<AdminJobsPage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(screen.getByText('Active Job')).toBeInTheDocument());
    const activeRow = screen.getByText('Active Job').closest('tr');

    fireEvent.click(within(activeRow!).getByText('Delete'));

    expect(
      await screen.findByText(/historical registrations\. Deactivate it instead\./),
    ).toBeInTheDocument();
  });
});
