import { Injectable, NotFoundException } from '@nestjs/common';
import { GenerateTicketReceiptReportDto } from '../dto/generate-ticket-receipt-report.dto';
import { PdfDownload } from '../models/pdf-download';
import { PdfRenderer } from '../models/pdf-renderer';
import { PdfDownloadService } from './pdf-download.service';
import { ReportConfigurationService } from './report-configuration.service';
import { TicketReceiptDataService } from './ticket-receipt-data.service';
import { TicketReceiptDocumentService } from './ticket-receipt-document.service';

/** Orchestrates ticket-receipt data, rendering, persistence, and download output. */
@Injectable()
export class TicketReceiptReportService {
  constructor(
    private readonly dataService: TicketReceiptDataService,
    private readonly documentService: TicketReceiptDocumentService,
    private readonly pdfRenderer: PdfRenderer,
    private readonly downloadService: PdfDownloadService,
    private readonly configurationService: ReportConfigurationService
  ) {}

  async generate(userId: string, options: GenerateTicketReceiptReportDto): Promise<PdfDownload> {
    const data = await this.dataService.getReportData(options);
    if (data.attendees.length === 0 && options.additionalBlankRows === 0) {
      throw new NotFoundException('No confirmed registrations match the selected report filters');
    }

    const document = this.documentService.build(options, data);
    const buffer = await this.pdfRenderer.render(document);
    const download = this.downloadService.create(buffer, `${options.title}-${data.year}`);
    await this.configurationService.saveTicketReceiptSettings(userId, options);

    return download;
  }
}
