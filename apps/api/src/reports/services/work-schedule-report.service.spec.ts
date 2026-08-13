import { NotFoundException } from '@nestjs/common';
import { GenerateWorkScheduleReportDto } from '../dto/generate-work-schedule-report.dto';
import { PdfRenderer } from '../models/pdf-renderer';
import { PdfDownloadService } from './pdf-download.service';
import { WorkScheduleDataService } from './work-schedule-data.service';
import { WorkScheduleDocumentService } from './work-schedule-document.service';
import { WorkScheduleReportService } from './work-schedule-report.service';

describe('WorkScheduleReportService', () => {
  const mockGetReportData = jest.fn();
  const mockBuild = jest.fn();
  const mockRender = jest.fn();
  const mockCreateDownload = jest.fn();
  let service: WorkScheduleReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkScheduleReportService(
      { getReportData: mockGetReportData } as unknown as WorkScheduleDataService,
      { build: mockBuild } as unknown as WorkScheduleDocumentService,
      { render: mockRender } as PdfRenderer,
      { create: mockCreateDownload } as unknown as PdfDownloadService
    );
  });

  it('shouldGenerateAPdfWithTheConfiguredTitle', async () => {
    const inputOptions = new GenerateWorkScheduleReportDto();
    const expectedDownload = {
      buffer: Buffer.from('%PDF'),
      contentType: 'application/pdf' as const,
      contentDisposition: 'attachment',
      filename: 'work-schedule.pdf',
    };
    mockGetReportData.mockResolvedValue({
      campName: 'Burning Sky',
      year: 2026,
      shifts: [{ id: 'shift' }],
    });
    mockBuild.mockReturnValue({ content: [] });
    mockRender.mockResolvedValue(Buffer.from('%PDF'));
    mockCreateDownload.mockReturnValue(expectedDownload);

    const actualDownload = await service.generate(inputOptions);

    expect(actualDownload).toBe(expectedDownload);
    expect(mockCreateDownload).toHaveBeenCalledWith(
      expect.any(Buffer),
      'Burning Sky Work Schedule 2026'
    );
  });

  it('shouldRejectAnEmptyScheduleBeforeRendering', async () => {
    mockGetReportData.mockResolvedValue({
      campName: 'Burning Sky',
      year: 2026,
      shifts: [],
    });

    await expect(service.generate(new GenerateWorkScheduleReportDto())).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(mockRender).not.toHaveBeenCalled();
  });
});
