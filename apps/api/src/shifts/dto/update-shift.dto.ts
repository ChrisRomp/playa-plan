import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DayOfWeek } from '../../common/enums/day-of-week.enum';

export class UpdateShiftDto {
  @ApiProperty({ description: 'The title of the shift', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'The description of the shift', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The start time of the shift', required: false })
  @IsDate()
  @IsOptional()
  startTime?: Date;

  @ApiProperty({ description: 'The end time of the shift', required: false })
  @IsDate()
  @IsOptional()
  endTime?: Date;

  @ApiProperty({ description: 'The maximum number of registrations allowed for this shift', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxParticipants?: number;

  @ApiProperty({ enum: DayOfWeek, description: 'The day of the week for this shift', required: false })
  @IsEnum(DayOfWeek)
  @IsOptional()
  dayOfWeek?: DayOfWeek;

  @ApiProperty({ description: 'The ID of the camp this shift belongs to', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: 'The ID of the job this shift is for', required: false })
  @IsInt()
  @IsOptional()
  jobId?: number;
} 