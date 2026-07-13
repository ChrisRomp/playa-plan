import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindPaymentsQueryDto } from './find-payments-query.dto';

describe('FindPaymentsQueryDto', () => {
  describe('skip', () => {
    it.each([0, 1, 100])('should accept valid skip %d', async (inputSkip) => {
      const inputQuery = plainToInstance(FindPaymentsQueryDto, {
        skip: String(inputSkip),
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual([]);
      expect(inputQuery.skip).toBe(inputSkip);
    });

    it.each([-1, -100])('should reject negative skip %d', async (inputSkip) => {
      const inputQuery = plainToInstance(FindPaymentsQueryDto, {
        skip: String(inputSkip),
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'skip',
            constraints: expect.objectContaining({ min: expect.any(String) }),
          }),
        ]),
      );
    });
  });

  describe('take', () => {
    it.each([1, 50, 10000])('should accept valid take %d', async (inputTake) => {
      const inputQuery = plainToInstance(FindPaymentsQueryDto, {
        take: String(inputTake),
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual([]);
      expect(inputQuery.take).toBe(inputTake);
    });

    it.each([0, -1, -100])('should reject non-positive take %d', async (inputTake) => {
      const inputQuery = plainToInstance(FindPaymentsQueryDto, {
        take: String(inputTake),
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'take',
            constraints: expect.objectContaining({ min: expect.any(String) }),
          }),
        ]),
      );
    });

    it('should reject take exceeding 10000', async () => {
      const inputQuery = plainToInstance(FindPaymentsQueryDto, {
        take: '10001',
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'take',
            constraints: expect.objectContaining({ max: expect.any(String) }),
          }),
        ]),
      );
    });
  });

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
