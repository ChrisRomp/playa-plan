import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { LEGACY_WRITABLE_PAYMENT_STATUSES } from './legacy-writable-payment-statuses';

/**
 * Data Transfer Object for updating a payment
 */
export class UpdatePaymentDto {
  @ApiProperty({
    description: 'The payment status',
    enum: LEGACY_WRITABLE_PAYMENT_STATUSES,
    example: PaymentStatus.COMPLETED,
  })
  @IsOptional()
  @IsIn(LEGACY_WRITABLE_PAYMENT_STATUSES)
  status?: PaymentStatus;

  @ApiProperty({
    description: 'The provider reference ID (for external payment systems)',
    example: 'pi_3MwDX2CZ6qsJgOG31M02Umy2',
    required: false,
  })
  @IsOptional()
  @IsString()
  providerRefId?: string;

  // Note: 'notes' field has been removed as it's not present in the Prisma Payment model
  // If notes functionality is needed, add the field to the Prisma schema first
} 