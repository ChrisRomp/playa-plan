import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import pdfmake from 'pdfmake';
import robotoFonts from 'pdfmake/fonts/Roboto';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PdfRenderer } from '../models/pdf-renderer';

/** pdfmake implementation of the shared PDF rendering contract. */
@Injectable()
export class PdfmakeRendererService extends PdfRenderer {
  private readonly fontDirectory = path.dirname(robotoFonts.Roboto.normal);

  constructor() {
    super();
    pdfmake.addFonts(robotoFonts);
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy(requestedPath => this.isBundledFontPath(requestedPath));
  }

  async render(document: TDocumentDefinitions): Promise<Buffer> {
    return pdfmake.createPdf(document).getBuffer();
  }

  private isBundledFontPath(requestedPath: string): boolean {
    const relativePath = path.relative(this.fontDirectory, path.resolve(requestedPath));

    return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }
}
