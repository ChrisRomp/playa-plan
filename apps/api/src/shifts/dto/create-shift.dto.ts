import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { DayOfWeek } from '../../common/enums/day-of-week.enum';

/**
 * Data Transfer Object for creating a new shift
 */
export class CreateShiftDto {
  @ApiProperty({ description: 'The name of the shift' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'The description of the shift' })
  @IsNotEmpty()
  @IsString()
  description!: string;

  @ApiProperty({ description: 'The maximum number of registrations allowed for this shift' })
  @IsNotEmpty()
  @IsInt()
  maxParticipants!: number;

  @ApiProperty({ description: 'The start time of the shift' })
  @IsNotEmpty()
  @IsDate()
  startTime!: Date;

  @ApiProperty({ description: 'The end time of the shift' })
  @IsNotEmpty()
  @IsDate()
  endTime!: Date;

  @ApiProperty({ enum: DayOfWeek, description: 'The day of the week for this shift' })
  @IsNotEmpty()
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @ApiProperty({ description: 'The location of the shift' })
  @IsNotEmpty()
  @IsString()
  location!: string;

  @ApiProperty({ description: 'The ID of the camp this shift belongs to' })
  @IsNotEmpty()
  @IsString()
  campId!: string;
}