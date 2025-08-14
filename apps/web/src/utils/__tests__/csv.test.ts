import { describe, it, expect } from 'vitest';
import { escapeCsvField, generateCsv, generateCsvAllQuoted } from '../csv';

describe('Proper CSV utility functions', () => {
  describe('escapeCsvField', () => {
    it('should not quote simple strings', () => {
      expect(escapeCsvField('simple')).toBe('simple');
      expect(escapeCsvField('123')).toBe('123');
      expect(escapeCsvField(123)).toBe('123');
    });

    it('should quote strings containing commas', () => {
      expect(escapeCsvField('hello, world')).toBe('"hello, world"');
    });

    it('should quote strings containing quotes and escape them', () => {
      expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
    });

    it('should quote strings containing newlines', () => {
      expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    });

    it('should quote strings containing carriage returns', () => {
      expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
    });

    it('should handle null and undefined values', () => {
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField(undefined)).toBe('');
    });

    it('should always quote when alwaysQuote is true', () => {
      expect(escapeCsvField('simple', true)).toBe('"simple"');
    });
  });

  describe('generateCsv', () => {
    it('should generate proper CSV with headers and data', () => {
      const headers = ['Name', 'Email'];
      const rows = [
        ['John Doe', 'john@example.com'],
        ['Jane Smith', 'jane@example.com'],
      ];

      const csv = generateCsv(headers, rows);
      expect(csv).toBe('Name,Email\nJohn Doe,john@example.com\nJane Smith,jane@example.com');
    });

    it('should properly escape fields with newlines', () => {
      const headers = ['Name', 'Description'];
      const rows = [
        ['John Doe', 'License A-123\nCoach rating'],
        ['Jane Smith', 'License B-456\r\nInstructor'],
      ];

      const csv = generateCsv(headers, rows);

      // The CSV should contain the properly escaped content
      const expectedCsv =
        'Name,Description\nJohn Doe,"License A-123\nCoach rating"\nJane Smith,"License B-456\r\nInstructor"';
      expect(csv).toBe(expectedCsv);

      // When parsed properly, it should represent exactly 2 data rows
      // We can verify this by checking that the quoted newlines don't break the structure
      expect(csv.startsWith('Name,Description\n')).toBe(true);
      expect(csv.includes('John Doe,"License A-123\nCoach rating"')).toBe(true);
      expect(csv.includes('Jane Smith,"License B-456\r\nInstructor"')).toBe(true);
    });

    it('should handle complex data with mixed escaping needs', () => {
      const headers = ['Name', 'Notes'];
      const rows = [
        ['John "Johnny" Doe', 'Has license A-123, very experienced\nCoach rating: excellent'],
        ['Jane Smith', 'Normal entry'],
      ];

      const csv = generateCsv(headers, rows);

      // Verify the structure contains properly escaped content
      expect(
        csv.includes(
          '"John ""Johnny"" Doe","Has license A-123, very experienced\nCoach rating: excellent"'
        )
      ).toBe(true);
      expect(csv.includes('Jane Smith,Normal entry')).toBe(true);
      expect(csv.startsWith('Name,Notes\n')).toBe(true);
    });
  });

  describe('generateCsvAllQuoted', () => {
    it('should quote all fields even simple ones', () => {
      const headers = ['Name', 'Email'];
      const rows = [['John', 'john@example.com']];

      const csv = generateCsvAllQuoted(headers, rows);
      expect(csv).toBe('"Name","Email"\n"John","john@example.com"');
    });
  });
});
