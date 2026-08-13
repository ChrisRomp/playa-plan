import { PdfDownloadService } from './pdf-download.service';

describe('PdfDownloadService', () => {
  const service = new PdfDownloadService();

  it('shouldCreateSafeAsciiAndUtf8Filenames', () => {
    const inputBuffer = Buffer.from('%PDF');

    const actualDownload = service.create(inputBuffer, 'Tïckets / 2026');

    expect(actualDownload.buffer).toBe(inputBuffer);
    expect(actualDownload.filename).toBe('Tïckets - 2026.pdf');
    expect(actualDownload.contentType).toBe('application/pdf');
    expect(actualDownload.contentDisposition).toContain('filename="Tickets-2026.pdf"');
    expect(actualDownload.contentDisposition).toContain("filename*=UTF-8''");
    expect(actualDownload.contentDisposition).not.toContain('\n');
  });

  it('shouldFallBackToReportForUnsafeNames', () => {
    const actualDownload = service.create(Buffer.from('%PDF'), '../../');

    expect(actualDownload.filename).toBe('report.pdf');
    expect(actualDownload.contentDisposition).toContain('filename="report.pdf"');
  });

  it('shouldTruncateUnicodeNamesWithoutSplittingSurrogatePairs', () => {
    const inputName = `${'a'.repeat(99)}😀`;

    const actualDownload = service.create(Buffer.from('%PDF'), inputName);

    expect(actualDownload.filename).toBe(`${inputName}.pdf`);
    expect(actualDownload.contentDisposition).toContain('%F0%9F%98%80.pdf');
  });

  it('shouldCollapseLongHyphenRunsWithoutBacktracking', () => {
    const inputName = `Tickets${'-'.repeat(10_000)}2026`;

    const actualDownload = service.create(Buffer.from('%PDF'), inputName);

    expect(actualDownload.filename).toBe('Tickets-2026.pdf');
    expect(actualDownload.contentDisposition).toContain('filename="Tickets-2026.pdf"');
  });
});
