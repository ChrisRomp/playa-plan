import { IsNotEmpty, IsArray, IsOptional, IsObject, IsBoolean, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for creating a comprehensive camp registration
 * This handles the complete registration process including camping options,
 * custom fields, multiple jobs, and terms acceptance.
 */
export class CreateCampRegistrationDto {
  @ApiProperty({
    description: 'Array of camping option IDs being selected',
    example: ['1d0f7f31-b6d6-4fce-9fe3-dd3d85eb448e'],
    type: [String],
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  @IsUUID(4, { each: true })
  campingOptions!: string[];

  @ApiProperty({
    description: 'Custom field values as key-value pairs',
    example: {
      'ef8937b4-70dc-4044-a669-77cfb22dae5e': 750,
      'fd1c2c00-b3c0-43bb-8413-dc0edc17daaf': 50,
      '75af2f45-38f3-446d-9a57-4f0e845a3a36': 'D-33327',
      '82647bda-42d0-455c-a5a9-5cbabdd04ed9': 9
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @ApiProperty({
    description:
      'Array of job IDs being registered for. May be empty when the user is ' +
      'flagged with allowNoJob=true (server enforces this).',
    example: ['8089a3d6-8c57-43ea-a2c3-037ff0c99546', '4bbb66ab-fcea-40bc-bdf6-9f813cf2d48f'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsUUID(4, { each: true })
  jobs!: string[];

  @ApiProperty({
    description: 'Whether the user has accepted the terms and conditions',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  acceptedTerms!: boolean;

  @ApiProperty({
    description:
      'Whether the participant is opting to defer dues payment. Requires ' +
      'both coreConfig.allowDeferredDuesPayment and user.allowDeferredDuesPayment ' +
      'to be true; otherwise the server rejects with 403. When true (and the ' +
      'resulting registration is not waitlisted), the registration is created ' +
      'as CONFIRMED with paymentDeferred=true.',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  deferPayment?: boolean = false;
}