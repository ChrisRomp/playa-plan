import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfig } from '../../hooks/useConfig';
import { campingOptions, reports } from '../../lib/api';
import { downloadFile } from '../../utils/downloadFile';
import { TicketReceiptReportPage } from '../TicketReceiptReportPage';

vi.mock('../../hooks/useConfig', () => ({
  useConfig: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  campingOptions: {
    getAll: vi.fn(),
  },
  reports: {
    getTicketReceiptSettings: vi.fn(),
    generateTicketReceipt: vi.fn(),
    getReportErrorMessage: vi.fn(),
  },
}));

vi.mock('../../utils/downloadFile', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('../../components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <span>Loading</span>,
}));

describe('TicketReceiptReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfig).mockReturnValue({
      config: {
        name: 'Burning Sky',
        description: 'Test camp',
        homePageBlurb: 'Welcome',
        registrationOpen: true,
        earlyRegistrationOpen: false,
        currentYear: 2026,
      },
      isLoading: false,
      error: null,
      refreshConfig: vi.fn(),
      isConnecting: false,
      isConnected: true,
      connectionError: null,
    });
    vi.mocked(reports.getTicketReceiptSettings).mockResolvedValue({
      title: 'Burning Sky Ticket Receipt',
      acknowledgementText: 'I received my ticket.',
    });
    vi.mocked(campingOptions.getAll).mockResolvedValue([
      {
        id: '89fb296e-201a-431d-a71c-9119871f41c2',
        name: 'Main Camp',
        enabled: true,
      },
    ] as Awaited<ReturnType<typeof campingOptions.getAll>>);
  });

  it('shouldLoadSharedAndDynamicDefaults', async () => {
    render(
      <MemoryRouter>
        <TicketReceiptReportPage />
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('Burning Sky Ticket Receipt')).toBeInTheDocument();
    expect(screen.getByDisplayValue('I received my ticket.')).toBeInTheDocument();
    expect(screen.getByLabelText('Registration year')).toHaveValue(2026);
    expect(screen.getByLabelText('Camping option')).toHaveValue('');
    expect(screen.getByLabelText('Additional blank rows')).toHaveValue(0);
  });

  it('shouldGenerateDownloadAndPersistDefaultsImplicitly', async () => {
    const inputBlob = new Blob(['pdf'], { type: 'application/pdf' });
    vi.mocked(reports.generateTicketReceipt).mockResolvedValue({
      blob: inputBlob,
      filename: 'burning-sky-tickets-2026.pdf',
    });
    render(
      <MemoryRouter>
        <TicketReceiptReportPage />
      </MemoryRouter>
    );
    await screen.findByDisplayValue('Burning Sky Ticket Receipt');

    fireEvent.change(screen.getByLabelText('Camping option'), {
      target: { value: '89fb296e-201a-431d-a71c-9119871f41c2' },
    });
    fireEvent.change(screen.getByLabelText('Additional blank rows'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate PDF' }));

    await waitFor(() => {
      expect(reports.generateTicketReceipt).toHaveBeenCalledWith({
        title: 'Burning Sky Ticket Receipt',
        acknowledgementText: 'I received my ticket.',
        year: 2026,
        campingOptionId: '89fb296e-201a-431d-a71c-9119871f41c2',
        additionalBlankRows: 4,
      });
    });
    expect(downloadFile).toHaveBeenCalledWith(inputBlob, 'burning-sky-tickets-2026.pdf');
    expect(
      screen.getByText(
        'Report downloaded. The title and acknowledgement are now the shared defaults.'
      )
    ).toBeInTheDocument();
  });

  it('shouldRequireAcknowledgementBeforeGenerating', async () => {
    render(
      <MemoryRouter>
        <TicketReceiptReportPage />
      </MemoryRouter>
    );
    await screen.findByDisplayValue('I received my ticket.');

    fireEvent.change(screen.getByLabelText('Acknowledgement'), {
      target: { value: ' ' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Generate PDF' }).closest('form')!);

    expect(screen.getByText('Acknowledgement text is required.')).toBeInTheDocument();
    expect(reports.generateTicketReceipt).not.toHaveBeenCalled();
  });

  it('shouldSurfaceGenerationErrors', async () => {
    vi.mocked(reports.generateTicketReceipt).mockRejectedValue(new Error('no rows'));
    vi.mocked(reports.getReportErrorMessage).mockReturnValue(
      'No confirmed registrations match the selected filters.'
    );
    render(
      <MemoryRouter>
        <TicketReceiptReportPage />
      </MemoryRouter>
    );
    await screen.findByDisplayValue('I received my ticket.');

    fireEvent.click(screen.getByRole('button', { name: 'Generate PDF' }));

    expect(
      await screen.findByText('No confirmed registrations match the selected filters.')
    ).toBeInTheDocument();
  });
});
