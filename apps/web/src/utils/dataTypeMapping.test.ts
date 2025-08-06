import { getDataTypeFriendlyName } from './dataTypeMapping';

describe('getDataTypeFriendlyName', () => {
  it('should return friendly names for all data types', () => {
    expect(getDataTypeFriendlyName('STRING')).toBe('Text');
    expect(getDataTypeFriendlyName('MULTILINE_STRING')).toBe('Multiline Text');
    expect(getDataTypeFriendlyName('NUMBER')).toBe('Number');
    expect(getDataTypeFriendlyName('INTEGER')).toBe('Integer');
    expect(getDataTypeFriendlyName('DATE')).toBe('Date');
    expect(getDataTypeFriendlyName('BOOLEAN')).toBe('Yes/No');
  });

  it('should return the original value for unmapped types', () => {
    expect(getDataTypeFriendlyName('UNKNOWN' as any)).toBe('UNKNOWN');
  });
});