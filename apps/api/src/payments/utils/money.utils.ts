const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

function getDecimalPlaces(value: number): number {
  const [coefficient, exponentText] = value
    .toString()
    .toLowerCase()
    .split('e');
  const fraction = coefficient.split('.')[1] ?? '';
  const exponent = Number(exponentText ?? 0);

  return Math.max(0, fraction.length - exponent);
}

/**
 * Converts a positive dollar amount to safe integer cents.
 */
export function dollarsToCents(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError('Dollar amount must be a positive finite number');
  }

  if (getDecimalPlaces(amount) > 2) {
    throw new RangeError('Dollar amount must not have sub-cent precision');
  }

  const amountCents = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountCents)) {
    throw new RangeError('Dollar amount exceeds the supported range');
  }

  return amountCents;
}

/**
 * Converts non-negative safe integer cents to dollars.
 */
export function centsToDollars(amountCents: number): number {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new RangeError('Cent amount must be a non-negative safe integer');
  }

  return amountCents / 100;
}

/**
 * Normalizes and validates a three-letter currency code.
 */
export function normalizeCurrency(currency: string): string {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (!CURRENCY_CODE_PATTERN.test(normalizedCurrency)) {
    throw new RangeError('Currency must be a three-letter code');
  }

  return normalizedCurrency;
}
