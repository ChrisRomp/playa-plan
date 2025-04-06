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

  @ApiProperty({
    description: 'Additional notes about the payment',
    example: 'Payment was processed manually after system error',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
} 