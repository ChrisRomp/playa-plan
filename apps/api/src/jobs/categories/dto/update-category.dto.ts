import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiProperty({
    description: 'The name of the job category',
    example: 'Kitchen',
    minLength: 1,
    required: false,
  })
  @IsString()
  @MinLength(1, { message: 'Category name must be at least 1 character long' })
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'The description of the job category',
    example: 'Kitchen-related jobs including food preparation and cleanup',
    minLength: 1,
    required: false,
  })
  @IsString()
  @MinLength(1, { message: 'Category description must be at least 1 character long' })
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Whether the category should only be visible to staff members',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  staffOnly?: boolean;

  @ApiProperty({
    description: 'Whether jobs in this category are always required for registration',
    example: false,
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  alwaysRequired?: boolean;
} 