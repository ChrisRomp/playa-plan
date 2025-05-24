import { IsString, IsNotEmpty, IsUUID, IsInt, IsOptional } from 'class-validator';
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
    description: 'The location of the job',
    example: 'Main Kitchen',
  })
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty({
    description: 'The ID of the job category',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({
    description: 'The ID of the shift this job is assigned to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  shiftId!: string;

  @ApiProperty({
    description: 'The maximum number of registrations allowed for this job',
    example: 10,
    default: 10,
  })
  @IsInt()
  @IsOptional()
  maxRegistrations?: number;
} 