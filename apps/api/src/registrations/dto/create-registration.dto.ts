import { IsNotEmpty, IsOptional, IsString, IsUUID, IsInt, IsArray, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for creating a new registration
 */
export class CreateRegistrationDto {
  @ApiProperty({
    description: 'ID of the user making the registration',
    example: '5f8d0d55-e0a3-4cf0-a620-2412acd4361c',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Year of the registration',
    example: 2024,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(2020)
  year!: number;

  @ApiProperty({
    description: 'IDs of the jobs being registered for',
    example: ['7c8d0d55-e0a3-4cf0-a620-2412acd4361d', '8c8d0d55-e0a3-4cf0-a620-2412acd4361e'],
  })
  @IsNotEmpty()
  @IsArray()
  @IsUUID(undefined, { each: true })
  jobIds!: string[];
}

/**
 * Data Transfer Object for adding a job to an existing registration
 */
export class AddJobToRegistrationDto {
  @ApiProperty({
    description: 'ID of the job to add to the registration',
    example: '7c8d0d55-e0a3-4cf0-a620-2412acd4361d',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  jobId!: string;
}
