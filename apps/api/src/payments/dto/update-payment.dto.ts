import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

const UPDATABLE_PAYMENT_STATUSES = [
  PaymentStatus.PENDING,
  PaymentStatus.COMPLETED,
  PaymentStatus.FAILED,
] as const;

type UpdatablePaymentStatus = typeof UPDATABLE_PAYMENT_STATUSES[number];

/**
 * Data Transfer Object for updating a payment
 */
export class UpdatePaymentDto {
  @ApiProperty({
    description: 'The payment status',
    enum: UPDATABLE_PAYMENT_STATUSES,
    example: PaymentStatus.COMPLETED,
  })
  @IsOptional()
  @IsIn(UPDATABLE_PAYMENT_STATUSES)
  status?: UpdatablePaymentStatus;

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