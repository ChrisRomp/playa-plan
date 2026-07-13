import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { RegistrationStatus } from '@prisma/client';
import { CAPACITY_RESERVING_STATUSES } from '../../registrations/constants/registration-status.constants';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';

/**
 * Data Transfer Object for creating a refund
 */
export class CreateRefundDto {
  @ApiProperty({
    description: 'ID of the payment to refund',
    example: '5f8d0d55-e0a3-4cf0-a620-2412acd4361c',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  paymentId!: string;

  @ApiProperty({
    description: 'The refund amount (optional, defaults to full amount)',
    example: 50.00,
    minimum: 0.01,
    maximum: PAYMENT_AMOUNT_LIMITS.majorUnits,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(PAYMENT_AMOUNT_LIMITS.majorUnits)
  amount?: number;

  @ApiProperty({
    description: 'Refund percentage of the original amount (alternative to specific amount)',
    example: 50,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  percentageOfOriginal?: number;

  @ApiProperty({
    description: 'Reason for the refund',
    example: 'Customer requested refund',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description:
      'Optional registration status to apply after the refund. Only post-application ' +
      'statuses are accepted here; use the dedicated cancellation flow to cancel a registration.',
    enum: CAPACITY_RESERVING_STATUSES,
    required: false,
  })
  @IsOptional()
  @IsIn(CAPACITY_RESERVING_STATUSES)
  resultingRegistrationStatus?: RegistrationStatus;
}