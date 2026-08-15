import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CoreConfigModule } from '../core-config/core-config.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { ReportsController } from './controllers/reports.controller';
import { PdfRenderer } from './models/pdf-renderer';
import { PdfDownloadService } from './services/pdf-download.service';
import { PdfmakeRendererService } from './services/pdfmake-renderer.service';
import { ReportConfigurationService } from './services/report-configuration.service';
import { TicketReceiptDataService } from './services/ticket-receipt-data.service';
import { TicketReceiptDocumentService } from './services/ticket-receipt-document.service';
import { TicketReceiptReportService } from './services/ticket-receipt-report.service';
import { WorkScheduleDataService } from './services/work-schedule-data.service';
import { WorkScheduleDocumentService } from './services/work-schedule-document.service';
import { WorkScheduleReportService } from './services/work-schedule-report.service';

/** Reusable PDF infrastructure and concrete PlayaPlan reports. */
@Module({
  imports: [PrismaModule, CoreConfigModule, ShiftsModule],
  controllers: [ReportsController],
  providers: [
    PdfDownloadService,
    PdfmakeRendererService,
    ReportConfigurationService,
    TicketReceiptDataService,
    TicketReceiptDocumentService,
    TicketReceiptReportService,
    WorkScheduleDataService,
    WorkScheduleDocumentService,
    WorkScheduleReportService,
    {
      provide: PdfRenderer,
      useExisting: PdfmakeRendererService,
    },
  ],
  exports: [PdfRenderer, PdfDownloadService],
})
export class ReportsModule {}
