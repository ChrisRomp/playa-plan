/** Binary PDF response and safe download headers returned by report services. */
export interface PdfDownload {
  readonly buffer: Buffer;
  readonly contentDisposition: string;
  readonly contentType: 'application/pdf';
  readonly filename: string;
}
