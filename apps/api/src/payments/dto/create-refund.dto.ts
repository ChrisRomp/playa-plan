import { Transform } from 'class-transformer';
import {
  Allow,
  Equals,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RefundExecutionMode, RegistrationStatus } from '@prisma/client';
import { centsToDollars } from '../utils/money.utils';

const ALLOWED_RESULTING_STATUSES = [
  RegistrationStatus.PENDING,
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.WAITLISTED,
] as const;

function normalizeOptionalText(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

@ValidatorConstraint({ name: 'refundAmountSelection', async: false })
class RefundAmountSelectionConstraint implements ValidatorConstraintInterface {
  validate(amountCents: unknown, validationArguments: ValidationArguments): boolean {
    const request = validationArguments.object as CreateRefundDto;
    const hasAmount = amountCents !== undefined;
    const hasFullRefund = request.fullRefund !== undefined;

    if (hasAmount === hasFullRefund) {
      return false;
    }

    if (hasFullRefund) {
      return request.fullRefund === true;
    }

    if (typeof amountCents !== 'number' || amountCents <= 0) {
      return false;
    }

    try {
      centsToDollars(amountCents);
      return true;
    } catch (error: unknown) {
      if (error instanceof RangeError) {
        return false;
      }

      throw error;
    }
  }

  defaultMessage(): string {
    return 'Provide exactly one of a positive integer amountCents within the supported range or fullRefund: true';
  }
}

/**
 * Data required to record an already-completed manual refund.
 */
export class CreateRefundDto {
  @ApiPropertyOptional({
    description: 'Positive refund amount in integer cents',
    example: 5000,
    minimum: 1,
  })
  @Validate(RefundAmountSelectionConstraint)
  amountCents?: number;

  @ApiPropertyOptional({
    description: 'Refund the full currently available balance',
    example: true,
  })
  @Allow()
  fullRefund?: boolean;

  @ApiProperty({
    description: 'Manual refunds record an already-completed external refund',
    enum: [RefundExecutionMode.MANUAL],
  })
  @Equals(RefundExecutionMode.MANUAL)
  executionMode!: RefundExecutionMode;

  @ApiPropertyOptional({
    description: 'Reason for the refund',
    maxLength: 500,
  })
  @Transform(({ value }: { value: unknown }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'External refund transaction or receipt reference',
    maxLength: 255,
  })
  @Transform(({ value }: { value: unknown }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalReference?: string;

  @ApiPropertyOptional({
    description: 'Optional registration status to apply after success',
    enum: ALLOWED_RESULTING_STATUSES,
  })
  @IsOptional()
  @IsIn(ALLOWED_RESULTING_STATUSES, {
    message:
      'resultingRegistrationStatus must be PENDING, CONFIRMED, or WAITLISTED; use the cancellation workflow to cancel a registration',
  })
  resultingRegistrationStatus?: RegistrationStatus;

  @ApiProperty({
    description: 'Client-generated idempotency key retained for retries',
    format: 'uuid',
  })
  @IsUUID()
  idempotencyKey!: string;
}
