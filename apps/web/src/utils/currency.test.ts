import { describe, it, expect } from 'vitest';
import { formatCurrency } from './currency';

describe('formatCurrency', () => {
  it('should format a valid USD amount with symbol and code', () => {
    expect(formatCurrency(150, 'USD')).toBe('$150.00 USD');
  });

  it('should format a valid EUR amount with symbol and code', () => {
    expect(formatCurrency(85.5, 'EUR')).toBe('€85.50 EUR');
  });

  it('should default to USD when currency is not provided', () => {
    expect(formatCurrency(25)).toBe('$25.00 USD');
  });

  it('should default the amount to zero when undefined', () => {
    expect(formatCurrency(undefined, 'USD')).toBe('$0.00 USD');
  });

  it('should normalize a lowercase currency code', () => {
    expect(formatCurrency(10, 'usd')).toBe('$10.00 USD');
  });

  it('should fall back to a plain amount and code for an invalid currency code instead of throwing', () => {
    expect(formatCurrency(150, 'US')).toBe('150.00 US');
  });

  it('should preserve the sign for a negative amount with an invalid currency code', () => {
    expect(formatCurrency(-42.5, 'XYZ123')).toBe('-42.50 XYZ123');
  });

  it('should preserve the sign for a negative amount with a valid currency code', () => {
    expect(formatCurrency(-42.5, 'USD')).toBe('-$42.50 USD');
  });
});
