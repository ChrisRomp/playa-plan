import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reports } from '../../lib/api';
import { ScheduleExceptionsReportPage } from '../ScheduleExceptionsReportPage';

vi.mock('../../lib/api', () => ({
  reports: {
    getScheduleExceptions: vi.fn(),
  },
}));

describe('ScheduleExceptionsReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reports.getScheduleExceptions).mockResolvedValue({
      year: 2026,
      exceptions: [
        {
          registrationId: 'registration-1',
          user: {
            id: 'user-1',
            firstName: 'Alex',
            lastName: 'Burner',
            playaName: 'Sparks',
            email: 'alex@example.com',
            role: 'PARTICIPANT',
            allowNoJob: false,
          },
          requiredCount: 1,
          selectedCount: 2,
          extraCount: 1,
          jobs: [
            {
              id: 'job-1',
              name: 'Kitchen',
              categoryName: 'Meals',
              shift: {
                id: 'shift-1',
                name: 'Monday AM',
                dayOfWeek: 'MONDAY',
                startTime: '09:00',
                endTime: '12:00',
              },
            },
            {
              id: 'job-2',
              name: 'Gate',
              categoryName: 'Operations',
              shift: {
                id: 'shift-2',
                name: 'Monday Midday',
                dayOfWeek: 'MONDAY',
                startTime: '11:00',
                endTime: '13:00',
              },
            },
          ],
          conflicts: [
            {
              firstJob: {
                id: 'job-1',
                name: 'Kitchen',
                shift: {
                  id: 'shift-1',
                  name: 'Monday AM',
                  dayOfWeek: 'MONDAY',
                  startTime: '09:00',
                  endTime: '12:00',
                },
              },
              secondJob: {
                id: 'job-2',
                name: 'Gate',
                shift: {
                  id: 'shift-2',
                  name: 'Monday Midday',
                  dayOfWeek: 'MONDAY',
                  startTime: '11:00',
                  endTime: '13:00',
                },
              },
            },
          ],
        },
      ],
    });
  });

  it('shouldRenderOveragesAndConflictsByRegistration', async () => {
    renderPage();

    expect(await screen.findByText('Alex Burner')).toBeInTheDocument();
    expect(screen.getByText('1 extra')).toBeInTheDocument();
    expect(screen.getByText('1 conflict')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Kitchen conflicts with Gate'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Schedule exceptions report' }),
    ).toBeInTheDocument();
  });

  it('shouldRenderAnEmptyState', async () => {
    vi.mocked(reports.getScheduleExceptions).mockResolvedValue({
      year: 2026,
      exceptions: [],
    });

    renderPage();

    expect(await screen.findByText('No schedule exceptions')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No confirmed 2026 registrations have extra or conflicting shifts.',
      ),
    ).toBeInTheDocument();
  });

  it('shouldRenderAnErrorState', async () => {
    vi.mocked(reports.getScheduleExceptions).mockRejectedValue(
      new Error('Network error'),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load schedule exceptions. Please try again.',
    );
  });

  it('shouldRenderALoadingState', () => {
    vi.mocked(reports.getScheduleExceptions).mockReturnValue(
      new Promise<never>(() => undefined),
    );

    renderPage();

    expect(screen.getByText('Loading schedule exceptions...')).toBeInTheDocument();
  });
});

function renderPage(): void {
  render(
    <MemoryRouter>
      <ScheduleExceptionsReportPage />
    </MemoryRouter>,
  );
}
