import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

/**
 * Data Transfer Object for creating a new payment
 */
export class CreatePaymentDto {
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
    description: 'The payment provider',
    enum: PaymentProvider,
    example: PaymentProvider.STRIPE,
  })
  @IsNotEmpty()
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @ApiProperty({
    description: 'The provider reference ID (for external payment systems)',
    example: 'pi_3MwDX2CZ6qsJgOG31M02Umy2',
    required: false,
  })
  @IsOptional()
  @IsString()
  providerRefId?: string;

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
} 