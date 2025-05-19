import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DayOfWeek } from '../../common/enums/day-of-week.enum';
import { Transform } from 'class-transformer';

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

  @ApiProperty({ description: 'The start time of the shift' })
  @IsNotEmpty()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  startTime!: Date;

  @ApiProperty({ description: 'The end time of the shift' })
  @IsNotEmpty()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  endTime!: Date;

  @ApiProperty({ enum: DayOfWeek, description: 'The day of the week for this shift' })
  @IsNotEmpty()
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;



  @ApiProperty({ description: 'The ID of the camp this shift belongs to' })
  @IsNotEmpty()
  @IsString()
  campId!: string;
}