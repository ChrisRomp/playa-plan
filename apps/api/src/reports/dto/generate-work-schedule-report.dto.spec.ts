import { DayOfWeek } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GenerateWorkScheduleReportDto } from './generate-work-schedule-report.dto';

describe('GenerateWorkScheduleReportDto', () => {
  it('shouldAllowAnEmptyRequestForTheFullSchedule', async () => {
    const inputDto = plainToInstance(GenerateWorkScheduleReportDto, {});

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
  });

  it('shouldAllowAValidDayFilter', async () => {
    const inputDto = plainToInstance(GenerateWorkScheduleReportDto, {
      dayOfWeek: DayOfWeek.CLOSING_SUNDAY,
      includeStaffOnly: false,
    });

    const actualErrors = await validate(inputDto);

    expect(actualErrors).toHaveLength(0);
  });

  it.each([null, 'SUNDAY', ''])('shouldRejectInvalidDayFilter%s', async dayOfWeek => {
    const inputDto = plainToInstance(GenerateWorkScheduleReportDto, { dayOfWeek });

    const actualErrors = await validate(inputDto);

    expect(actualErrors.some(error => error.property === 'dayOfWeek')).toBe(true);
  });

  it.each([null, 'false', 0])(
    'shouldRejectInvalidStaffOnlyFilter(%p)',
    async includeStaffOnly => {
      const inputDto = plainToInstance(GenerateWorkScheduleReportDto, { includeStaffOnly });

      const actualErrors = await validate(inputDto);

      expect(actualErrors.some(error => error.property === 'includeStaffOnly')).toBe(true);
    }
  );
});
