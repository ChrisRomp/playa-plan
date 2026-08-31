import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminCampingOptionQueryDto } from './admin-registration.dto';

describe('AdminCampingOptionQueryDto', () => {
  it.each(['2026', '2025'])(
    'should transform report year %s from an HTTP query string to a number',
    async (inputYear) => {
      const actualQuery = plainToInstance(
        AdminCampingOptionQueryDto,
        { year: inputYear },
      );
      const validationErrors = await validate(actualQuery);

      expect(validationErrors).toHaveLength(0);
      expect(actualQuery.year).toBe(Number(inputYear));
    },
  );

  it('should accept the deprecated includeInactive query parameter', async () => {
    const actualQuery = plainToInstance(
      AdminCampingOptionQueryDto,
      { includeInactive: 'true' },
    );
    const validationErrors = await validate(actualQuery);

    expect(validationErrors).toHaveLength(0);
    expect(actualQuery.includeInactive).toBe(true);
  });
});
