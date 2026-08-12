import { TDocumentDefinitions } from 'pdfmake/interfaces';

/** Report-agnostic contract for rendering a pdfmake document definition. */
export abstract class PdfRenderer {
  abstract render(document: TDocumentDefinitions): Promise<Buffer>;
}
