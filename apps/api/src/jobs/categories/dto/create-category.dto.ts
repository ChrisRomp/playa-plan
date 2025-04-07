import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'The name of the job category',
    example: 'Kitchen',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'The description of the job category',
    example: 'Kitchen related jobs',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;
} 