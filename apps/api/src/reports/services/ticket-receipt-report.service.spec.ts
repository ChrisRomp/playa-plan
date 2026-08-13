import { NotFoundException } from '@nestjs/common';
import { GenerateTicketReceiptReportDto } from '../dto/generate-ticket-receipt-report.dto';
import { PdfRenderer } from '../models/pdf-renderer';
import { PdfDownloadService } from './pdf-download.service';
import { ReportConfigurationService } from './report-configuration.service';
import { TicketReceiptDataService } from './ticket-receipt-data.service';
import { TicketReceiptDocumentService } from './ticket-receipt-document.service';
import { TicketReceiptReportService } from './ticket-receipt-report.service';

describe('TicketReceiptReportService', () => {
  const mockGetReportData = jest.fn();
  const mockBuild = jest.fn();
  const mockRender = jest.fn();
  const mockCreateDownload = jest.fn();
  const mockSaveSettings = jest.fn();
  let service: TicketReceiptReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketReceiptReportService(
      { getReportData: mockGetReportData } as unknown as TicketReceiptDataService,
      { build: mockBuild } as unknown as TicketReceiptDocumentService,
      { render: mockRender } as PdfRenderer,
      { create: mockCreateDownload } as unknown as PdfDownloadService,
      {
        saveTicketReceiptSettings: mockSaveSettings,
      } as unknown as ReportConfigurationService
    );
  });

  it('shouldGenerateThenPersistSharedDefaults', async () => {
    const inputOptions = Object.assign(new GenerateTicketReceiptReportDto(), {
      title: 'Ticket Pickup',
      acknowledgementText: 'Received',
      additionalBlankRows: 0,
    });
    const expectedDownload = {
      buffer: Buffer.from('%PDF'),
      contentType: 'application/pdf' as const,
      contentDisposition: 'attachment',
      filename: 'tickets.pdf',
    };
    mockGetReportData.mockResolvedValue({
      year: 2026,
      attendees: [{ name: 'Alex Burner', workShifts: '' }],
    });
    mockBuild.mockReturnValue({ content: [] });
    mockRender.mockResolvedValue(Buffer.from('%PDF'));
    mockCreateDownload.mockReturnValue(expectedDownload);

    const actualDownload = await service.generate('user-id', inputOptions);

    expect(actualDownload).toBe(expectedDownload);
    expect(mockRender.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateDownload.mock.invocationCallOrder[0]
    );
    expect(mockCreateDownload.mock.invocationCallOrder[0]).toBeLessThan(
      mockSaveSettings.mock.invocationCallOrder[0]
    );
    expect(mockSaveSettings).toHaveBeenCalledWith('user-id', inputOptions);
  });

  it('shouldAllowBlankOnlyReports', async () => {
    const inputOptions = Object.assign(new GenerateTicketReceiptReportDto(), {
      title: 'Ticket Pickup',
      acknowledgementText: 'Received',
      additionalBlankRows: 3,
    });
    mockGetReportData.mockResolvedValue({ year: 2026, attendees: [] });
    mockBuild.mockReturnValue({ content: [] });
    mockRender.mockResolvedValue(Buffer.from('%PDF'));

    await service.generate('user-id', inputOptions);

    expect(mockRender).toHaveBeenCalled();
  });

  it('shouldRejectEmptyReportsWithoutSavingDefaults', async () => {
    const inputOptions = Object.assign(new GenerateTicketReceiptReportDto(), {
      title: 'Ticket Pickup',
      acknowledgementText: 'Received',
      additionalBlankRows: 0,
    });
    mockGetReportData.mockResolvedValue({ year: 2026, attendees: [] });

    await expect(service.generate('user-id', inputOptions)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(mockRender).not.toHaveBeenCalled();
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('shouldNotPersistDefaultsWhenRenderingFails', async () => {
    const inputOptions = Object.assign(new GenerateTicketReceiptReportDto(), {
      title: 'Ticket Pickup',
      acknowledgementText: 'Received',
      additionalBlankRows: 1,
    });
    mockGetReportData.mockResolvedValue({ year: 2026, attendees: [] });
    mockBuild.mockReturnValue({ content: [] });
    mockRender.mockRejectedValue(new Error('render failed'));

    await expect(service.generate('user-id', inputOptions)).rejects.toThrow('render failed');
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('shouldNotPersistDefaultsWhenDownloadMetadataFails', async () => {
    const inputOptions = Object.assign(new GenerateTicketReceiptReportDto(), {
      title: 'Ticket Pickup',
      acknowledgementText: 'Received',
      additionalBlankRows: 1,
    });
    mockGetReportData.mockResolvedValue({ year: 2026, attendees: [] });
    mockBuild.mockReturnValue({ content: [] });
    mockRender.mockResolvedValue(Buffer.from('%PDF'));
    mockCreateDownload.mockImplementation(() => {
      throw new Error('download metadata failed');
    });

    await expect(service.generate('user-id', inputOptions)).rejects.toThrow(
      'download metadata failed'
    );
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });
});
