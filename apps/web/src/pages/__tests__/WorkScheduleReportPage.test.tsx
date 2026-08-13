import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reports } from '../../lib/api';
import { downloadCsv } from '../../utils/csv';
import { downloadFile } from '../../utils/downloadFile';
import { WorkScheduleReportPage } from '../WorkScheduleReportPage';

vi.mock('../../lib/api', () => ({
  reports: {
    getWorkSchedule: vi.fn(),
    generateWorkSchedulePdf: vi.fn(),
    getWorkScheduleReportErrorMessage: vi.fn(),
  },
}));

vi.mock('../../utils/csv', () => ({
  downloadCsv: vi.fn(),
}));

vi.mock('../../utils/downloadFile', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('../../components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <span>Loading</span>,
}));

describe('WorkScheduleReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reports.getWorkSchedule).mockResolvedValue({
      shifts: [
        {
          id: 'wednesday-am',
          name: 'Wednesday AM',
          dayOfWeek: 'WEDNESDAY',
          startTime: '09:30',
          endTime: '14:30',
          jobs: [
            {
              id: 'airport-manager',
              name: 'Airport Manager',
              location: 'Airport',
              maxRegistrations: 2,
              categoryId: 'operations',
              category: { id: 'operations', name: 'Operations' },
              registrations: [
                {
                  id: 'assignment',
                  user: {
                    id: 'worker',
                    firstName: 'Chris',
                    lastName: 'Romp',
                    playaName: 'romp',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('shouldKeepCsvExportAndDownloadTheFullPdf', async () => {
    const inputBlob = new Blob(['pdf'], { type: 'application/pdf' });
    vi.mocked(reports.generateWorkSchedulePdf).mockResolvedValue({
      blob: inputBlob,
      filename: 'Burning Sky Work Schedule 2026.pdf',
    });
    renderPage();
    await screen.findByText('Wednesday');

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(downloadCsv).toHaveBeenCalled();
    await waitFor(() => expect(reports.generateWorkSchedulePdf).toHaveBeenCalledWith({}));
    expect(downloadFile).toHaveBeenCalledWith(
      inputBlob,
      'Burning Sky Work Schedule 2026.pdf'
    );
  });

  it('shouldGenerateOnlyTheSelectedDay', async () => {
    vi.mocked(reports.generateWorkSchedulePdf).mockResolvedValue({
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      filename: 'work-schedule.pdf',
    });
    renderPage();
    await screen.findByText('Wednesday');

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Day of Week'), {
      target: { value: 'WEDNESDAY' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

    await waitFor(() =>
      expect(reports.generateWorkSchedulePdf).toHaveBeenCalledWith({
        dayOfWeek: 'WEDNESDAY',
      })
    );
  });

  it('shouldDisplayPdfGenerationErrors', async () => {
    vi.mocked(reports.generateWorkSchedulePdf).mockRejectedValue(new Error('failed'));
    vi.mocked(reports.getWorkScheduleReportErrorMessage).mockReturnValue(
      'Failed to generate the work schedule PDF. Please try again.'
    );
    renderPage();
    await screen.findByText('Wednesday');

    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(
      await screen.findByText('Failed to generate the work schedule PDF. Please try again.')
    ).toBeInTheDocument();
  });

  function renderPage(): void {
    render(
      <MemoryRouter>
        <WorkScheduleReportPage />
      </MemoryRouter>
    );
  }
});
