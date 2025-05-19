import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { DayOfWeek } from '../../common/enums/day-of-week.enum';

/**
 * Data Transfer Object for creating a new shift
 */
export class CreateShiftDto {
  @ApiProperty({ description: 'The name of the shift' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'The description of the shift', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'The start time of the shift in HH:MM format (24-hour time)', example: '09:00' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in HH:MM format (24-hour time)',
  })
  startTime!: string;

  @ApiProperty({ description: 'The end time of the shift in HH:MM format (24-hour time)', example: '17:00' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in HH:MM format (24-hour time)',
  })
  endTime!: string;

  @ApiProperty({ enum: DayOfWeek, description: 'The day of the week for this shift' })
  @IsNotEmpty()
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;



  @ApiProperty({ description: 'The ID of the camp this shift belongs to' })
  @IsNotEmpty()
  @IsString()
  campId!: string;
}