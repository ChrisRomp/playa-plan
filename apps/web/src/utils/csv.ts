/**
 * Generate CSV content from headers and row data.
 * Properly escapes fields containing commas, quotes, newlines, or carriage returns
 * according to RFC 4180 rules (double quotes escaped by doubling them and wrapping whole field in quotes).
 * Optionally can force quoting of all fields for safety/consistency.
 */
export interface GenerateCsvOptions {
  readonly alwaysQuote?: boolean;
  readonly lineTerminator?: string; // default \n
}

export function escapeCsvField(value: string | number | null | undefined, alwaysQuote = false): string {
  const str = String(value ?? '');
  const needsQuoting = alwaysQuote || /[",\n\r]/.test(str);
  if (!needsQuoting) return str;
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateCsv(headers: string[], rows: (string | number)[][], options: GenerateCsvOptions = {}): string {
  const { alwaysQuote = false, lineTerminator = '\n' } = options;
  const headerLine = headers.map(h => escapeCsvField(h, alwaysQuote)).join(',');
  const lines = rows.map(row => row.map(field => escapeCsvField(field, alwaysQuote)).join(','));
  return [headerLine, ...lines].join(lineTerminator);
}

/** Convenience wrapper that always quotes every field. */
export function generateCsvAllQuoted(headers: string[], rows: (string | number)[][], lineTerminator = '\n'): string {
  return generateCsv(headers, rows, { alwaysQuote: true, lineTerminator });
}
