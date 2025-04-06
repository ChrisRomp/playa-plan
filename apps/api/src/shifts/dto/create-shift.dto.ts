import { IsDateString, IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for creating a new shift
 */
export class CreateShiftDto {
  @ApiProperty({
    description: 'The start time of the shift',
    example: '2023-06-01T09:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description: 'The end time of the shift',
    example: '2023-06-01T17:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  endTime: string;

  @ApiProperty({
    description: 'Maximum number of registrations allowed for this shift',
    example: 10,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  maxRegistrations: number;

  @ApiProperty({
    description: 'ID of the camp this shift belongs to',
    example: '5f8d0d55-e0a3-4cf0-a620-2412acd4361c',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  campId: string;

  @ApiProperty({
    description: 'ID of the job this shift is for',
    example: '7c8d0d55-e0a3-4cf0-a620-2412acd4361d',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  jobId: string;
} 