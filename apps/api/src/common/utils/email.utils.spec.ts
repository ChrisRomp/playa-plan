import { normalizeEmail } from './email.utils';

describe('Email Utils', () => {
  describe('normalizeEmail', () => {
    it('should convert email to lowercase', () => {
      expect(normalizeEmail('User@Example.Com')).toBe('user@example.com');
    });

    it('should handle already lowercase emails', () => {
      expect(normalizeEmail('user@example.com')).toBe('user@example.com');
    });

    it('should handle uppercase emails', () => {
      expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    it('should handle mixed case emails', () => {
      expect(normalizeEmail('UsEr@ExAmPlE.cOm')).toBe('user@example.com');
    });

    it('should trim whitespace', () => {
      expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    it('should handle complex email addresses', () => {
      expect(normalizeEmail('  John.Doe+Test@Example.COM  ')).toBe('john.doe+test@example.com');
    });
  });
});