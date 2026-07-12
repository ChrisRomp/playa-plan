/**
 * Formats a numeric amount as a currency string using its ISO currency code,
 * e.g. formatCurrency(25, 'EUR') -> "€25.00 EUR". Falls back to USD when no
 * currency is provided.
 */
export function formatCurrency(amount: number | undefined, currency = 'USD'): string {
  const currencyCode = (currency || 'USD').toUpperCase();
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
  }).format(amount ?? 0);

  return `${formattedAmount} ${currencyCode}`;
}
