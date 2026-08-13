import { Injectable } from '@nestjs/common';
import { CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { GenerateTicketReceiptReportDto } from '../dto/generate-ticket-receipt-report.dto';
import { TicketReceiptReportData } from '../models/ticket-receipt-report-data';

const TABLE_COLUMN_WIDTHS = [110, 140, 225, 132, 63];

const TABLE_LAYOUT: CustomTableLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: '#4b5563',
  vLineColor: '#4b5563',
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 5,
  paddingBottom: () => 5,
};

/** Builds the ticket-receipt-specific pdfmake document definition. */
@Injectable()
export class TicketReceiptDocumentService {
  build(
    options: GenerateTicketReceiptReportDto,
    data: TicketReceiptReportData
  ): TDocumentDefinitions {
    return {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [36, 50, 36, 36],
      info: {
        title: options.title,
        author: 'PlayaPlan',
        subject: `Ticket receipt signatures for ${data.year}`,
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 9,
      },
      footer: (currentPage: number, pageCount: number) => ({
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'center',
        fontSize: 8,
        margin: [0, 12, 0, 0],
      }),
      content: [
        {
          text: options.title,
          style: 'reportTitle',
        },
        {
          text: `Registration year: ${data.year}`,
          alignment: 'center',
          margin: [0, 0, 0, 12],
        },
        {
          layout: TABLE_LAYOUT,
          table: {
            headerRows: 1,
            heights: (rowIndex: number) => (rowIndex === 0 ? 24 : 55),
            widths: TABLE_COLUMN_WIDTHS,
            body: this.buildRows(options, data),
          },
        },
      ],
      styles: {
        reportTitle: {
          alignment: 'center',
          bold: true,
          fontSize: 18,
          margin: [0, 0, 0, 4],
        },
      },
    };
  }

  private buildRows(
    options: GenerateTicketReceiptReportDto,
    data: TicketReceiptReportData
  ): TableCell[][] {
    const rows: TableCell[][] = [
      ['Name', 'Work Shift(s)', 'Acknowledgement', 'Signature', 'Date'].map(text =>
        this.buildHeaderCell(text)
      ),
    ];

    for (const attendee of data.attendees) {
      rows.push(
        this.buildSignatureRow(attendee.name, attendee.workShifts, options.acknowledgementText)
      );
    }

    for (let index = 0; index < options.additionalBlankRows; index += 1) {
      rows.push(this.buildSignatureRow('', '', options.acknowledgementText));
    }

    return rows;
  }

  private buildHeaderCell(text: string): TableCell {
    return {
      text,
      alignment: 'center',
      bold: true,
      fillColor: '#e5e7eb',
      verticalAlignment: 'middle',
    };
  }

  private buildSignatureRow(
    name: string,
    workShifts: string,
    acknowledgementText: string
  ): TableCell[] {
    return [
      { text: name, verticalAlignment: 'middle' },
      { text: workShifts, verticalAlignment: 'middle' },
      { text: acknowledgementText, verticalAlignment: 'middle' },
      { text: '', verticalAlignment: 'middle' },
      { text: '', verticalAlignment: 'middle' },
    ];
  }
}
