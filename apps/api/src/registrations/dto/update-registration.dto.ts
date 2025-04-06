import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
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
    description: 'ID of the shift being registered for',
    example: '7c8d0d55-e0a3-4cf0-a620-2412acd4361d',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  shiftId?: string;

  @ApiProperty({
    description: 'ID of the payment associated with this registration',
    example: '9c8d0d55-e0a3-4cf0-a620-2412acd4361e',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  paymentId?: string;
}
