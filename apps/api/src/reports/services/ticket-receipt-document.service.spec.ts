import { Content, ContentTable, CustomTableLayout } from 'pdfmake/interfaces';
import { GenerateTicketReceiptReportDto } from '../dto/generate-ticket-receipt-report.dto';
import { TicketReceiptDocumentService } from './ticket-receipt-document.service';

describe('TicketReceiptDocumentService', () => {
  it('shouldBuildAttendeeAndFillInRowsWithRepeatedHeader', () => {
    const service = new TicketReceiptDocumentService();
    const inputOptions = Object.assign(new GenerateTicketReceiptReportDto(), {
      title: 'Ticket Pickup',
      acknowledgementText: 'I received one ticket.',
      additionalBlankRows: 2,
    });

    const actualDocument = service.build(inputOptions, {
      year: 2026,
      attendees: [{ name: 'Alex Burner', workShifts: 'Gate (Monday)' }],
    });
    const content = actualDocument.content as Content[];
    const table = content[2] as ContentTable;
    const layout = table.layout as CustomTableLayout;

    expect(actualDocument.pageOrientation).toBe('landscape');
    expect(content[1]).toEqual(expect.objectContaining({ text: 'Registration Year: 2026' }));
    expect(table.table.headerRows).toBe(1);
    expect(table.table.dontBreakRows).toBe(true);
    expect(table.table.widths).toEqual([110, 140, 225, 132, 63]);
    expect(layout.hLineWidth).toEqual(expect.any(Function));
    expect(layout.vLineWidth).toEqual(expect.any(Function));
    expect(layout.hLineWidth?.(0, table)).toBe(1);
    expect(layout.vLineWidth?.(0, table)).toBe(1);
    expect(table.table.body).toHaveLength(4);
    expect(table.table.body[1]).toEqual([
      expect.objectContaining({ text: 'Alex Burner' }),
      expect.objectContaining({ text: 'Gate (Monday)' }),
      expect.objectContaining({ text: 'I received one ticket.' }),
      expect.objectContaining({ text: '' }),
      expect.objectContaining({ text: '' }),
    ]);
    expect(table.table.body[3][0]).toEqual(expect.objectContaining({ text: '' }));
    expect(table.table.body[3][2]).toEqual(
      expect.objectContaining({ text: 'I received one ticket.' })
    );
    expect(typeof actualDocument.footer).toBe('function');
  });
});
