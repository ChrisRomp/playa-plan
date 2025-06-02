import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminAuditActionType, AdminAuditTargetType, Prisma } from '@prisma/client';

/**
 * Data Transfer Object for creating an admin audit record
 */
export class CreateAdminAuditDto {
  @ApiProperty({
    description: 'ID of the admin user performing the action',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'Admin user ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Admin user ID is required' })
  adminUserId!: string;

  @ApiProperty({
    description: 'Type of action being performed',
    enum: AdminAuditActionType,
    example: AdminAuditActionType.REGISTRATION_EDIT,
  })
  @IsEnum(AdminAuditActionType, { message: 'Action type must be a valid AdminAuditActionType' })
  @IsNotEmpty({ message: 'Action type is required' })
  actionType!: AdminAuditActionType;

  @ApiProperty({
    description: 'Type of record being targeted',
    enum: AdminAuditTargetType,
    example: AdminAuditTargetType.REGISTRATION,
  })
  @IsEnum(AdminAuditTargetType, { message: 'Target record type must be a valid AdminAuditTargetType' })
  @IsNotEmpty({ message: 'Target record type is required' })
  targetRecordType!: AdminAuditTargetType;

  @ApiProperty({
    description: 'ID of the record being targeted',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID(4, { message: 'Target record ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Target record ID is required' })
  targetRecordId!: string;

  @ApiPropertyOptional({
    description: 'Previous values before the change (JSON)',
    example: { status: 'PENDING', campingOption: 'RV' },
  })
  @IsObject()
  @IsOptional()
  oldValues?: Prisma.InputJsonValue;

  @ApiPropertyOptional({
    description: 'New values after the change (JSON)',
    example: { status: 'CONFIRMED', campingOption: 'Tent' },
  })
  @IsObject()
  @IsOptional()
  newValues?: Prisma.InputJsonValue;

  @ApiPropertyOptional({
    description: 'Reason for the administrative action',
    example: 'User requested change due to vehicle breakdown',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Transaction ID to group related audit records',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID(4, { message: 'Transaction ID must be a valid UUID' })
  @IsOptional()
  transactionId?: string;
}

/**
 * Data Transfer Object for querying admin audit records
 */
export class AdminAuditQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by admin user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'Admin user ID must be a valid UUID' })
  @IsOptional()
  adminUserId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: AdminAuditActionType,
    example: AdminAuditActionType.REGISTRATION_EDIT,
  })
  @IsEnum(AdminAuditActionType, { message: 'Action type must be a valid AdminAuditActionType' })
  @IsOptional()
  actionType?: AdminAuditActionType;

  @ApiPropertyOptional({
    description: 'Filter by target record type',
    enum: AdminAuditTargetType,
    example: AdminAuditTargetType.REGISTRATION,
  })
  @IsEnum(AdminAuditTargetType, { message: 'Target record type must be a valid AdminAuditTargetType' })
  @IsOptional()
  targetRecordType?: AdminAuditTargetType;

  @ApiPropertyOptional({
    description: 'Filter by target record ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID(4, { message: 'Target record ID must be a valid UUID' })
  @IsOptional()
  targetRecordId?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID(4, { message: 'Transaction ID must be a valid UUID' })
  @IsOptional()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination (1-based)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    example: 50,
    default: 50,
  })
  @IsOptional()
  limit?: number;
} 