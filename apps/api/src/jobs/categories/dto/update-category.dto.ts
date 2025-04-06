import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiProperty({
    description: 'The name of the job category',
    example: 'Kitchen',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'The description of the job category',
    example: 'Kitchen-related jobs including food preparation and cleanup',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
} 