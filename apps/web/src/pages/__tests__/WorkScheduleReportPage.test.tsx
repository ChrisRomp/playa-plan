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

  it('shouldRetryPdfGenerationAfterADownloadError', async () => {
    const inputBlob = new Blob(['pdf'], { type: 'application/pdf' });
    vi.mocked(reports.generateWorkSchedulePdf)
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce({
        blob: inputBlob,
        filename: 'work-schedule.pdf',
      });
    vi.mocked(reports.getWorkScheduleReportErrorMessage).mockReturnValue(
      'Failed to generate the work schedule PDF. Please try again.'
    );
    renderPage();
    await screen.findByText('Wednesday');

    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(reports.generateWorkSchedulePdf).toHaveBeenCalledTimes(2));
    expect(reports.getWorkSchedule).toHaveBeenCalledTimes(1);
    expect(downloadFile).toHaveBeenCalledWith(inputBlob, 'work-schedule.pdf');
  });

  it('shouldOrderUnpaddedShiftTimesChronologicallyForDisplayAndCsv', async () => {
    vi.mocked(reports.getWorkSchedule).mockResolvedValue({
      shifts: [
        {
          id: 'afternoon',
          name: 'Afternoon',
          dayOfWeek: 'WEDNESDAY',
          startTime: '13:00',
          endTime: '14:00',
          jobs: [
            {
              id: 'afternoon-job',
              name: 'Afternoon Job',
              location: 'Camp',
              maxRegistrations: 1,
              categoryId: 'operations',
              category: { id: 'operations', name: 'Operations' },
              registrations: [],
            },
          ],
        },
        {
          id: 'morning',
          name: 'Morning',
          dayOfWeek: 'WEDNESDAY',
          startTime: '8:00',
          endTime: '09:00',
          jobs: [
            {
              id: 'morning-job',
              name: 'Morning Job',
              location: 'Camp',
              maxRegistrations: 1,
              categoryId: 'operations',
              category: { id: 'operations', name: 'Operations' },
              registrations: [],
            },
          ],
        },
      ],
    });
    renderPage();

    const morningHeading = await screen.findByText('Morning (8:00 - 09:00)');
    const afternoonHeading = screen.getByText('Afternoon (13:00 - 14:00)');
    expect(
      morningHeading.compareDocumentPosition(afternoonHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    const csvRows = vi.mocked(downloadCsv).mock.calls[0][1];
    expect(csvRows.map(row => row[1])).toEqual(['Morning', 'Afternoon']);
  });

  function renderPage(): void {
    render(
      <MemoryRouter>
        <WorkScheduleReportPage />
      </MemoryRouter>
    );
  }
});
