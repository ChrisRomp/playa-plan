import { parseTrustProxy } from './main';

describe('parseTrustProxy', () => {
  it('should return false when value is undefined', () => {
    const actual = parseTrustProxy(undefined);
    expect(actual).toBe(false);
  });

  it('should return false when value is empty', () => {
    const actual = parseTrustProxy('');
    expect(actual).toBe(false);
  });

  it('should return false for the string "false"', () => {
    const actual = parseTrustProxy('false');
    expect(actual).toBe(false);
  });

  it('should return false for "0"', () => {
    const actual = parseTrustProxy('0');
    expect(actual).toBe(false);
  });

  it('should return true for the string "true"', () => {
    const actual = parseTrustProxy('true');
    expect(actual).toBe(true);
  });

  it('should return a positive integer for numeric strings', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('3')).toBe(3);
  });

  it('should ignore surrounding whitespace and case', () => {
    expect(parseTrustProxy('  TRUE  ')).toBe(true);
    expect(parseTrustProxy('  2 ')).toBe(2);
  });

  it('should return false for negative numbers', () => {
    const actual = parseTrustProxy('-1');
    expect(actual).toBe(false);
  });

  it('should return false for non-numeric, non-boolean strings', () => {
    const actual = parseTrustProxy('garbage');
    expect(actual).toBe(false);
  });
});
