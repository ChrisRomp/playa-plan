import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindPaymentsQueryDto } from './find-payments-query.dto';

describe('FindPaymentsQueryDto', () => {
  it.each(['2026junk', 'invalid'])(
    'should reject malformed year %s',
    async (inputYear: string) => {
      const inputQuery = plainToInstance(FindPaymentsQueryDto, {
        year: inputYear,
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'year',
            constraints: expect.objectContaining({
              isInt: 'Year must be an integer',
            }),
          }),
        ]),
      );
    },
  );

  it('should transform and accept an integer year', async () => {
    const inputQuery = plainToInstance(FindPaymentsQueryDto, {
      year: '2026',
    });

    const actualErrors = await validate(inputQuery);

    expect(actualErrors).toEqual([]);
    expect(inputQuery.year).toBe(2026);
  });

  it.each([2000, 2100])(
    'should accept year at boundary %d',
    async (inputYear: number) => {
      const inputQuery = plainToInstance(FindPaymentsQueryDto, {
        year: String(inputYear),
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual([]);
      expect(inputQuery.year).toBe(inputYear);
    },
  );

  it.each([-1, 0, 1999, 2101, 999999999])(
    'should reject out-of-range year %d',
    async (inputYear: number) => {
      const inputQuery = plainToInstance(FindPaymentsQueryDto, {
        year: String(inputYear),
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'year',
            constraints: expect.objectContaining({
              ...(inputYear < 2000 ? { min: expect.any(String) } : {}),
              ...(inputYear > 2100 ? { max: expect.any(String) } : {}),
            }),
          }),
        ]),
      );
    },
  );
});
