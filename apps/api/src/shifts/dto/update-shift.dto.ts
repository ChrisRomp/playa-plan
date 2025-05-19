import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { DayOfWeek } from '../../common/enums/day-of-week.enum';

export class UpdateShiftDto {
  @ApiProperty({ description: 'The name of the shift', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'The description of the shift', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The start time of the shift in HH:MM format (24-hour time)', required: false, example: '09:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in HH:MM format (24-hour time)',
  })
  startTime?: string;

  @ApiProperty({ description: 'The end time of the shift in HH:MM format (24-hour time)', required: false, example: '17:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in HH:MM format (24-hour time)',
  })
  endTime?: string;

  @ApiProperty({ enum: DayOfWeek, description: 'The day of the week for this shift', required: false })
  @IsEnum(DayOfWeek)
  @IsOptional()
  dayOfWeek?: DayOfWeek;
} 