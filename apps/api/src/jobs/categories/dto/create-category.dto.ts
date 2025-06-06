import { IsString, IsNotEmpty, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'The name of the job category',
    example: 'Kitchen',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'Category name must be at least 1 character long' })
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'The description of the job category',
    example: 'Kitchen related jobs',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'Category description must be at least 1 character long' })
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    description: 'Whether the category should only be visible to staff members',
    example: false,
    default: false,
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