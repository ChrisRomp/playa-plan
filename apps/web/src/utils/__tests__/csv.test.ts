import { describe, it, expect } from 'vitest';
import { generateCsv } from '../csv';

// Regex matching a fully quoted CSV field including doubled quote escapes and embedded newlines.
// Used only in tests to strip out quoted segments so we can count top-level delimiters safely.
const QUOTED_CSV_FIELD_REGEX = /"(?:[^"]|""|\n|\r)*"/g;

/**
 * This test captures issue #116: multiline and comma-containing fields are not safely quoted,
 * resulting in row misalignment when opened in spreadsheet applications.
 */
describe('generateCsv (issue #116)', () => {
  it('should quote fields containing commas, quotes, or newlines so rows remain intact', () => {
    const headers = ['Name', 'Multi Field', 'Notes'];
    const rows = [
      [
        'Sample Person A',
        'Primary Identifier 12345 - issued by Example Authority\nQualifications: LEVEL1 (alpha, beta), LEVEL2, LEVEL3 (gamma & delta) & LEVELX (special operations - extended cases)',
        'Has complex multi-line data'
      ],
      [
        'Sample Person B',
        'Identifier: 98765\nCerts: A,B,C,D,E,F,G\nHistory: 250 Actions (5 years)',
        'Another multi-line with commas'
      ]
    ];

    const csv = generateCsv(headers, rows);

    // Logical line split (header + 2 data rows) by scanning for unquoted line terminators.
    const logicalLines: string[] = [];
    let buffer = '';
    let inQuotes = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      if (ch === '"') {
        if (inQuotes && csv[i + 1] === '"') { // escaped quote
          buffer += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        buffer += '"';
        continue;
      }
      if (!inQuotes && (ch === '\n' || ch === '\r')) {
        if (ch === '\r' && csv[i + 1] === '\n') i++; // normalize CRLF
        logicalLines.push(buffer);
        buffer = '';
        continue;
      }
      buffer += ch;
    }
    if (buffer) logicalLines.push(buffer);

    expect(logicalLines.length).toBe(3); // header + 2 rows

    const dataLines = logicalLines.slice(1);
    dataLines.forEach(line => {
      const stripped = line.replace(QUOTED_CSV_FIELD_REGEX, 'FIELD');
      const commaCount = (stripped.match(/,/g) || []).length;
      expect(commaCount).toBe(2);
    });

    // Verify known multi-line fields are quoted
    expect(csv).toMatch(/"Primary Identifier 12345 - issued by Example Authority/);
    expect(csv).toMatch(/"Identifier: 98765/);
  });
});
