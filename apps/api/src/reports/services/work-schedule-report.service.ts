import { Injectable, NotFoundException } from '@nestjs/common';
import { GenerateWorkScheduleReportDto } from '../dto/generate-work-schedule-report.dto';
import { PdfDownload } from '../models/pdf-download';
import { PdfRenderer } from '../models/pdf-renderer';
import { PdfDownloadService } from './pdf-download.service';
import { WorkScheduleDataService } from './work-schedule-data.service';
import { WorkScheduleDocumentService } from './work-schedule-document.service';

/** Orchestrates work-schedule data, rendering, and download output. */
@Injectable()
export class WorkScheduleReportService {
  constructor(
    private readonly dataService: WorkScheduleDataService,
    private readonly documentService: WorkScheduleDocumentService,
    private readonly pdfRenderer: PdfRenderer,
    private readonly downloadService: PdfDownloadService
  ) {}

  async generate(options: GenerateWorkScheduleReportDto): Promise<PdfDownload> {
    const data = await this.dataService.getReportData(options);
    if (data.shifts.length === 0) {
      throw new NotFoundException(
        options.dayOfWeek
          ? 'No work schedule matches the selected day'
          : 'No work schedule is available'
      );
    }

    const document = this.documentService.build(data);
    const buffer = await this.pdfRenderer.render(document);
    return this.downloadService.create(
      buffer,
      `${data.campName} Work Schedule ${data.year}`
    );
  }
}
