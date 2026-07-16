import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { LEGACY_WRITABLE_PAYMENT_STATUSES } from './legacy-writable-payment-statuses';

/**
 * Data Transfer Object for recording a manual payment
 */
export class RecordManualPaymentDto {
  @ApiProperty({
    description: 'The payment amount',
    example: 100.00,
    minimum: 0.01,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
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
    enum: LEGACY_WRITABLE_PAYMENT_STATUSES,
    example: PaymentStatus.COMPLETED,
    default: PaymentStatus.COMPLETED,
  })
  @IsOptional()
  @IsIn(LEGACY_WRITABLE_PAYMENT_STATUSES)
  status?: PaymentStatus = PaymentStatus.COMPLETED;

  @ApiProperty({
    description: 'Reference information for this manual payment',
    example: 'Cash payment collected on 2023-05-15',
    required: false,
  })
  @IsOptional()
  @IsString()
  reference: string | undefined;

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