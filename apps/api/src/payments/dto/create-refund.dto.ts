import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
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
} 