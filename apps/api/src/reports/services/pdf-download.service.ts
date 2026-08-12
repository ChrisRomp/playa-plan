import { Injectable } from '@nestjs/common';
import { PdfDownload } from '../models/pdf-download';

const MAX_FILENAME_LENGTH = 100;

/** Creates safe, reusable HTTP download metadata for generated PDFs. */
@Injectable()
export class PdfDownloadService {
  create(buffer: Buffer, requestedName: string): PdfDownload {
    const filename = `${this.sanitizeUnicodeName(requestedName)}.pdf`;
    const fallbackFilename = `${this.sanitizeAsciiName(requestedName)}.pdf`;
    const encodedFilename = this.encodeRfc5987(filename);

    return {
      buffer,
      contentDisposition: `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
      contentType: 'application/pdf',
      filename,
    };
  }

  private sanitizeUnicodeName(value: string): string {
    const sanitized = value
      .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '-')
      .replace(/\.{2,}/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();

    return Array.from(sanitized).slice(0, MAX_FILENAME_LENGTH).join('') || 'report';
  }

  private sanitizeAsciiName(value: string): string {
    const sanitized = value
      .normalize('NFKD')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '-')
      .replace(/\.{2,}/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, MAX_FILENAME_LENGTH);

    return sanitized || 'report';
  }

  private encodeRfc5987(value: string): string {
    return encodeURIComponent(value).replace(
      /['()*]/g,
      character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
    );
  }
}
