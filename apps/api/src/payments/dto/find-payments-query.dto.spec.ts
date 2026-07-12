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
});
