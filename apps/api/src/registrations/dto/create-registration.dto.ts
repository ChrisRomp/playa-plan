import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for creating a new registration
 */
export class CreateRegistrationDto {
  @ApiProperty({
    description: 'ID of the user making the registration',
    example: '5f8d0d55-e0a3-4cf0-a620-2412acd4361c',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'ID of the job being registered for',
    example: '7c8d0d55-e0a3-4cf0-a620-2412acd4361d',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  jobId!: string;

  @ApiProperty({
    description: 'ID of the payment associated with this registration (optional)',
    example: '9c8d0d55-e0a3-4cf0-a620-2412acd4361e',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  paymentId?: string;
}
