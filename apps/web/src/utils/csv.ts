/**
 * CSV utility functions for properly escaping and generating CSV content
 * according to RFC 4180 specification.
 */

export interface GenerateCsvOptions {
  readonly alwaysQuote?: boolean;
  readonly lineTerminator?: string; // default \n
}

/**
 * Escapes a CSV field value according to RFC 4180 rules:
 * - Fields containing commas, quotes, newlines, or carriage returns must be quoted
 * - Quotes within fields are escaped by doubling them
 * - The entire field is wrapped in quotes if it needs escaping
 */
export function escapeCsvField(
  value: string | number | null | undefined,
  alwaysQuote = false
): string {
  const str = String(value ?? '');
  const needsQuoting = alwaysQuote || /[",\n\r]/.test(str);

  if (!needsQuoting) {
    return str;
  }

  // Escape quotes by doubling them and wrap the entire field in quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates CSV content from headers and row data with proper escaping
 */
export function generateCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options: GenerateCsvOptions = {}
): string {
  const { alwaysQuote = false, lineTerminator = '\n' } = options;

  const headerLine = headers.map(h => escapeCsvField(h, alwaysQuote)).join(',');
  const dataLines = rows.map(row => row.map(field => escapeCsvField(field, alwaysQuote)).join(','));

  return [headerLine, ...dataLines].join(lineTerminator);
}

/**
 * Convenience wrapper that always quotes every field for maximum compatibility
 */
export function generateCsvAllQuoted(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  lineTerminator = '\n'
): string {
  return generateCsv(headers, rows, { alwaysQuote: true, lineTerminator });
}
