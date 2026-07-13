import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminRegistrationQueryDto,
  AdminCampingOptionQueryDto,
  ExternalPaymentRegistrationSearchQueryDto,
} from './admin-registration.dto';

describe('AdminRegistrationQueryDto year validation', () => {
  it.each([2020, 2026, 2100])(
    'should accept year at or within bounds: %d',
    async (inputYear: number) => {
      const inputQuery = plainToInstance(AdminRegistrationQueryDto, {
        year: String(inputYear),
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual([]);
      expect(inputQuery.year).toBe(inputYear);
    },
  );

  it.each([2019, 2101, 999999999])(
    'should reject out-of-range year: %d',
    async (inputYear: number) => {
      const inputQuery = plainToInstance(AdminRegistrationQueryDto, {
        year: String(inputYear),
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'year',
          }),
        ]),
      );
    },
  );
});

describe('ExternalPaymentRegistrationSearchQueryDto year validation', () => {
  it.each([2020, 2026, 2100])(
    'should accept year at or within bounds: %d',
    async (inputYear: number) => {
      const inputQuery = plainToInstance(
        ExternalPaymentRegistrationSearchQueryDto,
        { year: String(inputYear) },
      );

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual([]);
      expect(inputQuery.year).toBe(inputYear);
    },
  );

  it.each([2019, 2101, 999999999])(
    'should reject out-of-range year: %d',
    async (inputYear: number) => {
      const inputQuery = plainToInstance(
        ExternalPaymentRegistrationSearchQueryDto,
        { year: String(inputYear) },
      );

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'year',
          }),
        ]),
      );
    },
  );
});

describe('AdminCampingOptionQueryDto year validation', () => {
  it.each([2020, 2026, 2100])(
    'should accept year at or within bounds: %d',
    async (inputYear: number) => {
      const inputQuery = plainToInstance(AdminCampingOptionQueryDto, {
        year: String(inputYear),
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual([]);
      expect(inputQuery.year).toBe(inputYear);
    },
  );

  it.each([2019, 2101, 999999999])(
    'should reject out-of-range year: %d',
    async (inputYear: number) => {
      const inputQuery = plainToInstance(AdminCampingOptionQueryDto, {
        year: String(inputYear),
      });

      const actualErrors = await validate(inputQuery);

      expect(actualErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            property: 'year',
          }),
        ]),
      );
    },
  );
});
