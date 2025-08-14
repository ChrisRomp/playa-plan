import { describe, it, expect } from 'vitest';
import { generateCsv } from '../csv';

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
      ],
    ];

    const csv = generateCsv(headers, rows);

    // Parse logical lines accounting for quoted newlines
    const logicalLines: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      if (ch === '"') {
        // Lookahead for escaped quote
        if (inQuotes && csv[i + 1] === '"') {
          current += '"';
          i++; // skip next
          continue;
        }
        inQuotes = !inQuotes;
        current += ch; // keep quote if needed
        continue;
      }
      if ((ch === '\n' || ch === '\r') && !inQuotes) {
        // line boundary (normalize CRLF/CR/LF)
        if (ch === '\r' && csv[i + 1] === '\n') i++; // swallow LF of CRLF
        logicalLines.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.length) logicalLines.push(current);

    expect(logicalLines.length).toBe(3); // header + 2 rows

    const dataLines = logicalLines.slice(1);
    dataLines.forEach(line => {
      // Count top-level commas ignoring those inside quotes by stripping quoted sections
      const stripped = line.replace(/"(?:[^"]|""|\n|\r)*"/g, 'FIELD');
      const commaCount = (stripped.match(/,/g) || []).length;
      expect(commaCount).toBe(2);
    });

    // Verify that a known multi-line field is quoted and internal quotes escaped if present
  expect(csv).toMatch(/"Primary Identifier 12345 - issued by Example Authority/);
    // Ensure second multi-line value is quoted
  expect(csv).toMatch(/"Identifier: 98765/);
  });
});
