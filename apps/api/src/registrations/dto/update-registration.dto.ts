import { IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RegistrationStatus } from '@prisma/client';

/**
 * Data Transfer Object for updating a registration
 */
export class UpdateRegistrationDto {
  @ApiProperty({
    description: 'Status of the registration',
    enum: RegistrationStatus,
    example: RegistrationStatus.CONFIRMED,
    required: false,
  })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiProperty({
    description: 'Year of the registration',
    example: 2024,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(2020)
  year?: number;
}
