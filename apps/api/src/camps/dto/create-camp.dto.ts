import { IsString, IsDateString, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCampDto {
  @ApiProperty({
    description: 'Name of the camp',
    example: 'Summer Camp 2025',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Description of the camp',
    example: 'A fun summer camp with various activities',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Start date of the camp in ISO format',
    example: '2025-06-15T00:00:00.000Z',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    description: 'End date of the camp in ISO format',
    example: '2025-06-22T00:00:00.000Z',
  })
  @IsDateString()
  endDate!: string;

  @ApiProperty({
    description: 'Location where the camp will be held',
    example: 'Mountain View Camp Ground',
  })
  @IsString()
  location!: string;

  @ApiProperty({
    description: 'Maximum number of participants',
    example: 100,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  capacity!: number;

  @ApiProperty({
    description: 'Whether the camp is currently active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}