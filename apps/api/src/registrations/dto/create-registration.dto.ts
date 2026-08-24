import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({
    description: 'Confirms an administrator intends to create a registration with conflicting work shifts',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Conflict override confirmation must be a boolean' })
  conflictOverrideConfirmed?: boolean = false;
}
