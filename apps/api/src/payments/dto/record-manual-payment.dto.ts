import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';
import { IsCentsPrecision } from './cents-precision.validator';

const RECORDABLE_PAYMENT_STATUSES = [
  PaymentStatus.PENDING,
  PaymentStatus.COMPLETED,
  PaymentStatus.FAILED,
] as const;

type RecordablePaymentStatus = typeof RECORDABLE_PAYMENT_STATUSES[number];

/**
 * Data Transfer Object for recording a manual payment
 */
export class RecordManualPaymentDto {
  @ApiProperty({
    description: 'The payment amount',
    example: 100.00,
    minimum: 0.01,
    maximum: PAYMENT_AMOUNT_LIMITS.majorUnits,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  @Max(PAYMENT_AMOUNT_LIMITS.majorUnits)
  @IsCentsPrecision()
  amount!: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @ApiProperty({
    description: 'The payment status',
    enum: RECORDABLE_PAYMENT_STATUSES,
    example: PaymentStatus.COMPLETED,
    default: PaymentStatus.COMPLETED,
  })
  @IsOptional()
  @IsIn(RECORDABLE_PAYMENT_STATUSES)
  status?: RecordablePaymentStatus = PaymentStatus.COMPLETED;

  @ApiProperty({
    description: 'How the external payment was received',
    example: 'Check',
    required: false,
  })
  @IsOptional()
  @IsString()
  externalPaymentMethod?: string;

  @ApiProperty({
    description: 'Reference information for this external payment',
    example: 'Check #1234 collected on 2023-05-15',
    required: false,
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({
    description: 'ID of the user the payment is for',
    example: '5f8d0d55-e0a3-4cf0-a620-2412acd4361c',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'ID of the registration this payment is for (optional)',
    example: '7c8d0d55-e0a3-4cf0-a620-2412acd4361d',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  registrationId?: string;
} 