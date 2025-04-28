import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobDto {
  @ApiProperty({
    description: 'The name of the job',
    example: 'Kitchen Helper',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'The description of the job',
    example: 'Assist in meal preparation and cleanup',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    description: 'The location of the job',
    example: 'Main Kitchen',
  })
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty({
    description: 'Whether the job is only available to staff members',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  staffOnly?: boolean;

  @ApiProperty({
    description: 'Whether the job is always required regardless of camp settings',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  alwaysRequired?: boolean;

  @ApiProperty({
    description: 'The ID of the job category',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;
} 