import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

/**
 * Data Transfer Object for updating a payment
 */
export class UpdatePaymentDto {
  @ApiProperty({
    description: 'The payment status',
    enum: PaymentStatus,
    example: PaymentStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
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