import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { DayOfWeek } from '@libs/types/enums/day-of-week.enum';

export class UpdateShiftDto {
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
  maxRegistrations?: number;

  @ApiProperty({ enum: DayOfWeek, description: 'The day of the week for this shift', required: false })
  @IsEnum(DayOfWeek)
  @IsOptional()
  dayOfWeek?: DayOfWeek;

  @ApiProperty({ description: 'The ID of the camp this shift belongs to', required: false })
  @IsString()
  @IsOptional()
  @IsUUID()
  campId?: string;

  @ApiProperty({ description: 'The ID of the job this shift is for', required: false })
  @IsString()
  @IsOptional()
  @IsUUID()
  jobId?: string;
} 