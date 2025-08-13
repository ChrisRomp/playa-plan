import { 
  IsEnum, 
  IsOptional, 
  IsString, 
  IsUUID, 
  IsArray, 
  IsNotEmpty,
  IsBoolean,
  IsInt,
  Min,
  ValidateNested
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationStatus, Registration, FieldType } from '@prisma/client';

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
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
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

/**
 * DTO for camping option field value in admin responses
 */
export class CampingOptionFieldValueDto {
  @ApiProperty({
    description: 'Field value ID',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  id: string;

  @ApiProperty({
    description: 'The actual value entered by the user',
    example: 'ABC123',
  })
  value: string;

  @ApiProperty({
    description: 'ID of the field this value belongs to',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  fieldId: string;

  @ApiProperty({
    description: 'ID of the camping option registration this value belongs to',
    example: '123e4567-e89b-12d3-a456-426614174005',
  })
  registrationId: string;

  @ApiProperty({
    description: 'Field definition information',
  })
  field: {
    id: string;
    displayName: string;
    dataType: FieldType;
    required: boolean;
  };

  @ApiProperty({
    description: 'Timestamp when this field value was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when this field value was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * DTO for camping option registration with field values in admin responses
 */
export class CampingOptionRegistrationWithFieldsDto {
  @ApiProperty({
    description: 'Camping option registration ID',
    example: '123e4567-e89b-12d3-a456-426614174006',
  })
  id: string;

  @ApiProperty({
    description: 'User ID who registered for this camping option',
    example: '123e4567-e89b-12d3-a456-426614174007',
  })
  userId: string;

  @ApiProperty({
    description: 'Camping option ID',
    example: '123e4567-e89b-12d3-a456-426614174008',
  })
  campingOptionId: string;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    playaName: string | null;
  };

  @ApiProperty({
    description: 'Camping option information with field definitions',
  })
  campingOption: {
    id: string;
    name: string;
    description: string | null;
    enabled: boolean;
    fields: Array<{
      id: string;
      displayName: string;
      dataType: FieldType;
      required: boolean;
      order: number;
    }>;
  };

  @ApiProperty({
    description: 'Array of field values for this camping option registration',
    type: [CampingOptionFieldValueDto],
  })
  @ValidateNested({ each: true })
  @Type(() => CampingOptionFieldValueDto)
  fieldValues: CampingOptionFieldValueDto[];

  @ApiProperty({
    description: 'Timestamp when this camping option registration was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when this camping option registration was last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * DTO for admin camping option query parameters
 */
export class AdminCampingOptionQueryDto {
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
    description: 'Filter by user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'User ID must be a valid UUID' })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by camping option ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Camping option ID must be a valid UUID' })
  campingOptionId?: string;

  @ApiPropertyOptional({
    description: 'Include inactive camping options in results',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Include inactive must be a boolean' })
  includeInactive?: boolean = false;
} 