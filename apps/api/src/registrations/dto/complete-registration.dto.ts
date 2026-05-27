import { IsNotEmpty, IsArray, IsOptional, IsBoolean, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for completing a registration after application approval.
 * Adds jobs, terms acceptance, and payment option to an existing
 * APPLICATION_APPROVED registration.
 */
export class CompleteRegistrationDto {
  @ApiProperty({
    description: 'Array of job IDs to register for',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsUUID(4, { each: true })
  jobs!: string[];

  @ApiProperty({
    description: 'Whether the user has accepted the terms and conditions',
  })
  @IsNotEmpty()
  @IsBoolean()
  acceptedTerms!: boolean;

  @ApiProperty({
    description: 'Whether to defer dues payment',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  deferPayment?: boolean;
}
