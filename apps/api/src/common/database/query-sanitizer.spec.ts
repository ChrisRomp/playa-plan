import {
  sanitizeString,
  sanitizeId,
  sanitizeObject,
  sanitizeSortField,
} from './query-sanitizer';

describe('Query Sanitizer Utility', () => {
  describe('sanitizeString', () => {
    it('should escape single quotes to prevent SQL injection', () => {
      const input = "O'Reilly";
      const sanitized = sanitizeString(input);
      expect(sanitized).toBe("O''Reilly");
    });

    it('should escape backslashes', () => {
      const input = 'C:\\Program Files\\App';
      const sanitized = sanitizeString(input);
      expect(sanitized).toBe('C:\\\\Program Files\\\\App');
    });

    it('should remove null bytes', () => {
      const input = 'malicious\0input';
      const sanitized = sanitizeString(input);
      expect(sanitized).toBe('maliciousinput');
    });

    it('should strip SQL keywords', () => {
      const input = 'DROP TABLE users; SELECT * FROM passwords';
      const sanitized = sanitizeString(input);
      expect(sanitized).not.toContain('DROP');
      expect(sanitized).not.toContain('SELECT');
      expect(sanitized).not.toContain('FROM');
    });

    it('should handle SQL injection attempts', () => {
      const input = "1'; DROP TABLE users; --";
      const sanitized = sanitizeString(input);
      expect(sanitized).not.toContain('DROP TABLE');
      expect(sanitized).toBe("1'';  users; --");
    });

    it('should return empty string if input is not a string', () => {
      const input = undefined as unknown as string;
      const sanitized = sanitizeString(input);
      expect(sanitized).toBe('');
    });

    it('should trim whitespace', () => {
      const input = '  test string  ';
      const sanitized = sanitizeString(input);
      expect(sanitized).toBe('test string');
    });
  });

  describe('sanitizeId', () => {
    it('should return a valid numeric ID', () => {
      const validId = sanitizeId(123);
      expect(validId).toBe(123);
    });

    it('should convert string IDs to numbers', () => {
      const stringId = sanitizeId('456');
      expect(stringId).toBe(456);
    });

    it('should reject negative IDs', () => {
      const negativeId = sanitizeId(-1);
      expect(negativeId).toBeNull();
    });

    it('should reject zero as an ID', () => {
      const zeroId = sanitizeId(0);
      expect(zeroId).toBeNull();
    });

    it('should reject non-numeric strings', () => {
      const invalidId = sanitizeId('abc123');
      expect(invalidId).toBeNull();
    });

    it('should reject SQL injection in IDs', () => {
      const sqlInjection = sanitizeId('1 OR 1=1');
      expect(sqlInjection).toBeNull();
    });

    it('should return null for null input', () => {
      const nullInput = sanitizeId(null);
      expect(nullInput).toBeNull();
    });

    it('should return null for undefined input', () => {
      const undefinedInput = sanitizeId(undefined);
      expect(undefinedInput).toBeNull();
    });

    it('should reject IDs that exceed MAX_SAFE_INTEGER', () => {
      const hugeId = sanitizeId(Number.MAX_SAFE_INTEGER + 1);
      expect(hugeId).toBeNull();
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string properties in an object', () => {
      const input = {
        name: "O'Reilly",
        description: 'SELECT * FROM users',
      };

      const sanitized = sanitizeObject(input);
      expect(sanitized.name).toBe("O''Reilly");
      expect(sanitized.description).not.toContain('SELECT');
    });

    it('should recursively sanitize nested objects', () => {
      const input = {
        user: {
          name: "O'Reilly",
          profile: {
            bio: 'DROP TABLE users',
          },
        },
      };

      const sanitized = sanitizeObject(input);
      expect(sanitized.user.name).toBe("O''Reilly");
      expect(sanitized.user.profile.bio).not.toContain('DROP TABLE');
    });

    it('should leave non-string properties unchanged', () => {
      const input = {
        id: 123,
        active: true,
        price: 19.99,
        data: null,
      };

      const sanitized = sanitizeObject(input);
      expect(sanitized).toEqual(input);
    });

    it('should return the original input if not an object', () => {
      const input = 'not an object';
      const sanitized = sanitizeObject(input as unknown as Record<string, unknown>);
      expect(sanitized).toBe(input);
    });

    it('should handle null or undefined input', () => {
      const nullInput = sanitizeObject(null as unknown as Record<string, unknown>);
      expect(nullInput).toBeNull();

      const undefinedInput = sanitizeObject(undefined as unknown as Record<string, unknown>);
      expect(undefinedInput).toBeUndefined();
    });
  });

  describe('sanitizeSortField', () => {
    const allowedFields = ['id', 'name', 'createdAt', 'updatedAt'];

    it('should allow valid sort fields', () => {
      const validField = sanitizeSortField('name', allowedFields);
      expect(validField).toBe('name');
    });

    it('should reject sort fields not in the allowed list', () => {
      const invalidField = sanitizeSortField('password', allowedFields);
      expect(invalidField).toBeNull();
    });

    it('should sanitize input by removing non-alphanumeric characters', () => {
      const dirtyField = sanitizeSortField('name;DROP TABLE', allowedFields);
      expect(dirtyField).toBe('name');
    });

    it('should allow underscores in field names', () => {
      const fieldWithUnderscore = sanitizeSortField('created_at', ['user_id', 'created_at']);
      expect(fieldWithUnderscore).toBe('created_at');
    });

    it('should return null for empty input', () => {
      const emptyField = sanitizeSortField('', allowedFields);
      expect(emptyField).toBeNull();
    });

    it('should return null for non-string input', () => {
      const nonStringField = sanitizeSortField(123 as unknown as string, allowedFields);
      expect(nonStringField).toBeNull();
    });

    it('should be case-sensitive for field names', () => {
      const capitalField = sanitizeSortField('Name', allowedFields);
      expect(capitalField).toBeNull();
    });
  });
});