import { describe, it, expect } from 'vitest';
import { getFriendlyDayName, formatTime } from '../shiftUtils';

describe('shiftUtils', () => {
  describe('getFriendlyDayName', () => {
    it('should return friendly names for standard days', () => {
      expect(getFriendlyDayName('MONDAY')).toBe('Monday');
      expect(getFriendlyDayName('TUESDAY')).toBe('Tuesday');
      expect(getFriendlyDayName('WEDNESDAY')).toBe('Wednesday');
      expect(getFriendlyDayName('THURSDAY')).toBe('Thursday');
      expect(getFriendlyDayName('FRIDAY')).toBe('Friday');
      expect(getFriendlyDayName('SATURDAY')).toBe('Saturday');
      expect(getFriendlyDayName('SUNDAY')).toBe('Sunday');
    });

    it('should return friendly names for special event days', () => {
      expect(getFriendlyDayName('PRE_OPENING')).toBe('Pre-Opening');
      expect(getFriendlyDayName('OPENING_SUNDAY')).toBe('Opening Sunday');
      expect(getFriendlyDayName('CLOSING_SUNDAY')).toBe('Closing Sunday');
      expect(getFriendlyDayName('POST_EVENT')).toBe('Post-Event');
    });

    it('should handle lowercase day names', () => {
      expect(getFriendlyDayName('monday')).toBe('Monday');
      expect(getFriendlyDayName('pre_opening')).toBe('Pre-Opening');
    });

    it('should return original value for unknown days', () => {
      expect(getFriendlyDayName('UNKNOWN_DAY')).toBe('UNKNOWN_DAY');
    });

    it('should return empty string for empty input', () => {
      expect(getFriendlyDayName('')).toBe('');
    });
  });

  describe('formatTime', () => {
    it('should return HH:MM format strings as-is', () => {
      expect(formatTime('09:00')).toBe('09:00');
      expect(formatTime('14:30')).toBe('14:30');
      expect(formatTime('23:59')).toBe('23:59');
    });

    it('should format valid date strings to time', () => {
      const dateString = '2024-01-01T14:30:00Z';
      const result = formatTime(dateString);
      // Just check that it's formatted as HH:MM (could be 24-hour format or with AM/PM)
      expect(result).toMatch(/^\d{1,2}:\d{2}(\s?(AM|PM))?$/);
    });

    it('should return original string for invalid date strings', () => {
      expect(formatTime('invalid-date')).toBe('invalid-date');
      expect(formatTime('not-a-time')).toBe('not-a-time');
    });

    it('should handle edge cases gracefully', () => {
      expect(formatTime('')).toBe('');
      // This should not throw an error
      expect(() => formatTime('some random text')).not.toThrow();
    });
  });
}); 