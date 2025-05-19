import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/**
 * Data Transfer Object for initiating a Stripe payment
 */
export class CreateStripePaymentDto {
  @ApiProperty({
    description: 'The payment amount in cents (Stripe uses integer amounts)',
    example: 10000, // $100.00
    minimum: 50, // $0.50 minimum
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(50)
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
    description: 'Description of the payment',
    example: 'Camp registration fee',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Success URL to redirect to after successful payment',
    example: 'https://mycamp.playaplan.app/success',
    required: false,
  })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiProperty({
    description: 'Cancel URL to redirect to if payment is cancelled',
    example: 'https://mycamp.playaplan.app/cancel',
    required: false,
  })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
} 