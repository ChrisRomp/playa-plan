import { 
  IsEnum, 
  IsOptional, 
  IsString, 
  IsUUID, 
  IsArray, 
  IsNotEmpty,
  IsBoolean,
  IsInt,
  Min
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationStatus, Registration } from '@prisma/client';

/**
 * DTO for editing a registration by an admin
 */
export class AdminEditRegistrationDto {
  @ApiPropertyOptional({
    description: 'Updated status of the registration',
    enum: RegistrationStatus,
    example: RegistrationStatus.CONFIRMED,
  })
  @IsOptional()
  @IsEnum(RegistrationStatus, { message: 'Status must be a valid RegistrationStatus' })
  status?: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'Array of job IDs to assign to this registration',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true, message: 'Each job ID must be a valid UUID' })
  jobIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of camping option IDs to assign to this registration',
    example: ['123e4567-e89b-12d3-a456-426614174001'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true, message: 'Each camping option ID must be a valid UUID' })
  campingOptionIds?: string[];

  @ApiPropertyOptional({
    description: 'Notes or reason for the administrative action',
    example: 'User requested change due to vehicle breakdown',
  })
  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Whether to send notification to user about the changes',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Send notification must be a boolean' })
  sendNotification?: boolean = false;
}

/**
 * DTO for cancelling a registration by an admin
 */
export class AdminCancelRegistrationDto {
  @ApiProperty({
    description: 'Reason for cancelling the registration',
    example: 'User unable to attend due to emergency',
  })
  @IsString({ message: 'Reason must be a string' })
  @IsNotEmpty({ message: 'Reason is required for cancellation' })
  reason!: string;

  @ApiPropertyOptional({
    description: 'Whether to send notification to user about the cancellation',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Send notification must be a boolean' })
  sendNotification?: boolean = false;

  @ApiPropertyOptional({
    description: 'Whether to process a refund for any payments (admin will be prompted)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Process refund must be a boolean' })
  processRefund?: boolean = true;
}

/**
 * DTO for admin registration query parameters
 */
export class AdminRegistrationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'User ID must be a valid UUID' })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by registration year',
    example: 2024,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Year must be an integer' })
  @Min(2020, { message: 'Year must be 2020 or later' })
  year?: number;

  @ApiPropertyOptional({
    description: 'Filter by registration status',
    enum: RegistrationStatus,
    example: RegistrationStatus.CONFIRMED,
  })
  @IsOptional()
  @IsEnum(RegistrationStatus, { message: 'Status must be a valid RegistrationStatus' })
  status?: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'Search by user email (partial match)',
    example: 'john@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Search by user name (partial match)',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination (ignored - returns all records for admin interface)',
    example: 1,
    deprecated: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be 1 or greater' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of records per page (ignored - returns all records for admin interface)',
    example: 50,
    deprecated: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be 1 or greater' })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Include camping option registrations and field values in the response',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include camping options must be a boolean' })
  includeCampingOptions?: boolean = false;
}

/**
 * Response DTO for admin registration operations
 */
export class AdminRegistrationResponseDto {
  @ApiProperty({
    description: 'The registration that was modified',
  })
  registration: Registration;

  @ApiProperty({
    description: 'Transaction ID for grouping related audit records',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  transactionId: string;

  @ApiProperty({
    description: 'Confirmation message for the operation',
    example: 'Registration successfully updated',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Information about notification status',
    example: 'Notification sent to user',
  })
  notificationStatus?: string;

  @ApiPropertyOptional({
    description: 'Information about refund processing',
    example: 'Refund of $150.00 needs to be processed manually',
  })
  refundInfo?: string;
} 