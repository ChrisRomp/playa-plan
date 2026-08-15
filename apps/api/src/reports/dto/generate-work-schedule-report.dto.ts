import { ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';
import { IsBoolean, IsEnum, ValidateIf } from 'class-validator';

/** Validated options for generating a printable work schedule. */
export class GenerateWorkScheduleReportDto {
  @ApiPropertyOptional({
    description: 'Event day to include; omit to include the full schedule',
    enum: DayOfWeek,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @ApiPropertyOptional({
    description: 'Whether to include staff-only jobs',
    default: true,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  includeStaffOnly?: boolean;
}
