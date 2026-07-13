import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { PAYMENT_AMOUNT_LIMITS } from '../constants/payment-amount-limits.constants';
import { IsCentsPrecision } from './cents-precision.validator';

/**
 * Data Transfer Object for initiating a PayPal payment
 */
export class CreatePaypalPaymentDto {
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
    description: 'ID of the user making the payment',
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

  @ApiProperty({
    description: 'Description of the payment item',
    example: 'Camp registration fee',
  })
  @IsNotEmpty()
  @IsString()
  itemDescription!: string;

  @ApiProperty({
    description: 'Success URL to redirect to after successful payment',
    example: 'https://mycamp.playaplan.app/success',
  })
  @IsNotEmpty()
  @IsString()
  successUrl!: string;

  @ApiProperty({
    description: 'Cancel URL to redirect to if payment is cancelled',
    example: 'https://mycamp.playaplan.app/cancel',
  })
  @IsNotEmpty()
  @IsString()
  cancelUrl!: string;
} 