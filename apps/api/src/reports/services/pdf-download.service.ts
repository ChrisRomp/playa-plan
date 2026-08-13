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
    const replaced = value
      .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '-')
      .replace(/\.{2,}/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    const sanitized = this.collapseAndTrimHyphens(replaced);

    return Array.from(sanitized).slice(0, MAX_FILENAME_LENGTH).join('') || 'report';
  }

  private sanitizeAsciiName(value: string): string {
    const replaced = value
      .normalize('NFKD')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '-')
      .replace(/\.{2,}/g, '-')
      .replace(/\s+/g, '-');
    const sanitized = this.collapseAndTrimHyphens(replaced).slice(0, MAX_FILENAME_LENGTH);

    return sanitized || 'report';
  }

  private collapseAndTrimHyphens(value: string): string {
    const characters: string[] = [];
    let previousWasHyphen = false;

    for (const character of value) {
      if (character === '-') {
        if (characters.length === 0 || previousWasHyphen) {
          continue;
        }
        previousWasHyphen = true;
      } else {
        previousWasHyphen = false;
      }
      characters.push(character);
    }

    if (characters[characters.length - 1] === '-') {
      characters.pop();
    }

    return characters.join('');
  }

  private encodeRfc5987(value: string): string {
    return encodeURIComponent(value).replace(
      /['()*]/g,
      character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
    );
  }
}
