import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExternalPaymentMethod } from '@prisma/client';

function normalizeOptionalReference(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedReference = value.trim();
  return normalizedReference.length > 0 ? normalizedReference : undefined;
}

/**
 * Data required to record an already-completed payment made outside PlayaPlan.
 */
export class CreateExternalPaymentDto {
  @ApiProperty({
    description: 'Registration receiving the completed external payment',
    format: 'uuid',
  })
  @IsUUID()
  registrationId!: string;

  @ApiProperty({
    description: 'Positive payment amount in decimal dollars',
    example: 125.5,
    minimum: 0.01,
  })
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 },
    { message: 'Amount must be a positive number with at most two decimal places' },
  )
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({
    description: 'Three-letter currency code',
    default: 'USD',
    example: 'USD',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'Currency must be a three-letter code' })
  currency: string = 'USD';

  @ApiProperty({
    description: 'Real-world method used for the external payment',
    enum: ExternalPaymentMethod,
  })
  @IsEnum(ExternalPaymentMethod)
  externalMethod!: ExternalPaymentMethod;

  @ApiPropertyOptional({
    description: 'External transaction, check, or receipt reference',
    maxLength: 255,
  })
  @Transform(({ value }: { value: unknown }) => normalizeOptionalReference(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalReference?: string;

  @ApiProperty({
    description: 'Client-generated idempotency key retained for retries',
    format: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID()
  idempotencyKey!: string;
}
