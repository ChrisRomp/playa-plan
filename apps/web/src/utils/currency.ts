/**
 * Formats a numeric amount as a currency string using its ISO currency code,
 * e.g. formatCurrency(25, 'EUR') -> "€25.00 EUR". Falls back to USD when no
 * currency is provided. If the currency code is not a valid ISO 4217 code
 * (e.g. legacy/malformed data such as "US"), `Intl.NumberFormat` throws a
 * `RangeError`; in that case this falls back to a plain, non-symbol amount
 * (e.g. "25.00 US") instead of crashing the caller.
 */
export function formatCurrency(amount: number | undefined, currency = 'USD'): string {
  const currencyCode = (currency || 'USD').toUpperCase();
  const value = amount ?? 0;

  try {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).format(value);

    return `${formattedAmount} ${currencyCode}`;
  } catch (error) {
    if (error instanceof RangeError) {
      return `${value.toFixed(2)} ${currencyCode}`;
    }
    throw error;
  }
}
