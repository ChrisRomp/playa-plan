import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeCsvField, generateCsv, generateCsvAllQuoted, downloadCsv } from '../csv';

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

    it('should handle null and undefined values in rows', () => {
      const headers = ['Name', 'Email', 'Phone'];
      const rows = [
        ['John Doe', null, '555-1234'],
        ['Jane Smith', 'jane@example.com', undefined],
      ];

      const csv = generateCsv(headers, rows);
      expect(csv).toBe('Name,Email,Phone\nJohn Doe,,555-1234\nJane Smith,jane@example.com,');
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

  describe('downloadCsv', () => {
    // Mock DOM elements and methods
    let mockLink: HTMLAnchorElement;
    let mockCreateElement: ReturnType<typeof vi.fn>;
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let mockClick: ReturnType<typeof vi.fn>;
    let mockAppendChild: ReturnType<typeof vi.fn>;
    let mockRemoveChild: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // Mock document.createElement
      mockClick = vi.fn();
      mockLink = {
        setAttribute: vi.fn(),
        click: mockClick,
        style: {}
      } as unknown as HTMLAnchorElement;
      
      mockCreateElement = vi.fn(() => mockLink);
      mockAppendChild = vi.fn();
      mockRemoveChild = vi.fn();
      
      // Mock global objects
      Object.defineProperty(global, 'document', {
        writable: true,
        value: {
          createElement: mockCreateElement,
          body: {
            appendChild: mockAppendChild,
            removeChild: mockRemoveChild
          }
        }
      });

      mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      mockRevokeObjectURL = vi.fn();
      
      Object.defineProperty(global, 'URL', {
        writable: true,
        value: {
          createObjectURL: mockCreateObjectURL,
          revokeObjectURL: mockRevokeObjectURL
        }
      });

      // Mock Blob
      Object.defineProperty(global, 'Blob', {
        writable: true,
        value: vi.fn((content: BlobPart[], options?: BlobPropertyBag) => ({
          content,
          type: options?.type || '',
          size: content.length
        }))
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create CSV with BOM by default and trigger download', () => {
      const headers = ['Name', 'Email'];
      const rows = [['John Doe', 'john@example.com']];

      downloadCsv(headers, rows, { filename: 'test.csv' });

      // Verify Blob was created with BOM
      expect(global.Blob).toHaveBeenCalledWith(
        ['\uFEFFName,Email\nJohn Doe,john@example.com'],
        { type: 'text/csv;charset=utf-8;' }
      );

      // Verify download process
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock-url');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test.csv');
      expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should allow disabling BOM', () => {
      const headers = ['Name'];
      const rows = [['John']];

      downloadCsv(headers, rows, { includeBom: false });

      expect(global.Blob).toHaveBeenCalledWith(
        ['Name\nJohn'],
        { type: 'text/csv;charset=utf-8;' }
      );
    });

    it('should use default filename when not provided', () => {
      const headers = ['Name'];
      const rows = [['John']];

      downloadCsv(headers, rows);

      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'download',
        expect.stringMatching(/^export_\d{4}-\d{2}-\d{2}\.csv$/)
      );
    });

    it('should handle complex data with proper escaping and BOM', () => {
      const headers = ['Name', 'Description'];
      const rows = [
        ['John "Johnny" Doe', 'Has license A-123, very experienced\nCoach rating: excellent'],
        ['Jane Smith', 'Normal entry']
      ];

      downloadCsv(headers, rows);

      const expectedCsv = '\uFEFFName,Description\n"John ""Johnny"" Doe","Has license A-123, very experienced\nCoach rating: excellent"\nJane Smith,Normal entry';
      expect(global.Blob).toHaveBeenCalledWith(
        [expectedCsv],
        { type: 'text/csv;charset=utf-8;' }
      );
    });
  });
});
