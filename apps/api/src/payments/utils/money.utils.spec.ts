import {
  centsToDollars,
  dollarsToCents,
  normalizeCurrency,
} from './money.utils';

describe('money utilities', () => {
  describe('dollarsToCents', () => {
    it.each([
      [0.01, 1],
      [1e-2, 1],
      [0.1, 10],
      [10.01, 1001],
      [1234.56, 123456],
    ])('should convert %s dollars to %s cents', (inputDollars, expectedCents) => {
      const actualCents = dollarsToCents(inputDollars);

      expect(actualCents).toBe(expectedCents);
    });

    it.each([0, -0.01, Number.NaN, Number.POSITIVE_INFINITY])(
      'should reject invalid dollar amount %s',
      (inputDollars) => {
        expect(() => dollarsToCents(inputDollars)).toThrow(
          'Dollar amount must be a positive finite number',
        );
      },
    );

    it.each([10.001, Number.MIN_VALUE])(
      'should reject sub-cent precision for %s',
      (inputDollars) => {
        expect(() => dollarsToCents(inputDollars)).toThrow(
          'Dollar amount must not have sub-cent precision',
        );
      },
    );

    it('should reject amounts that cannot be represented as safe integer cents', () => {
      const inputDollars = (Number.MAX_SAFE_INTEGER + 1) / 100;

      expect(() => dollarsToCents(inputDollars)).toThrow(
        'Dollar amount exceeds the supported range',
      );
    });
  });

  describe('centsToDollars', () => {
    it.each([
      [0, 0],
      [1, 0.01],
      [10, 0.1],
      [1001, 10.01],
    ])('should convert %s cents to %s dollars', (inputCents, expectedDollars) => {
      const actualDollars = centsToDollars(inputCents);

      expect(actualDollars).toBe(expectedDollars);
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'should reject invalid cent amount %s',
      (inputCents) => {
        expect(() => centsToDollars(inputCents)).toThrow(
          'Cent amount must be a non-negative safe integer',
        );
      },
    );

    it('should reject unsafe integer cents', () => {
      expect(() => centsToDollars(Number.MAX_SAFE_INTEGER + 1)).toThrow(
        'Cent amount must be a non-negative safe integer',
      );
    });
  });

  describe('normalizeCurrency', () => {
    it.each([
      ['usd', 'USD'],
      [' Usd ', 'USD'],
      ['eur', 'EUR'],
    ])('should normalize %s to %s', (inputCurrency, expectedCurrency) => {
      const actualCurrency = normalizeCurrency(inputCurrency);

      expect(actualCurrency).toBe(expectedCurrency);
    });

    it.each(['', 'US', 'USDD', 'U1D', '$US'])(
      'should reject invalid currency code %s',
      (inputCurrency) => {
        expect(() => normalizeCurrency(inputCurrency)).toThrow(
          'Currency must be a three-letter code',
        );
      },
    );
  });
});
