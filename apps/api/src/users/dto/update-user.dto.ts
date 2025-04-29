import { IsEmail, IsEnum, IsOptional, IsString, MinLength, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * Data Transfer Object for updating a user
 * All fields are optional since updates may only include some fields
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  readonly email?: string;

  @ApiPropertyOptional({
    description: 'User password',
    example: 'NewSecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsOptional()
  readonly password?: string;

  @ApiPropertyOptional({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  readonly firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  readonly lastName?: string;

  @ApiPropertyOptional({
    description: 'User playa name',
    example: 'Dusty',
  })
  @IsString()
  @IsOptional()
  readonly playaName?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1-555-123-4567',
  })
  @IsString()
  @IsOptional()
  readonly phone?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'San Francisco',
  })
  @IsString()
  @IsOptional()
  readonly city?: string;

  @ApiPropertyOptional({
    description: 'State or province',
    example: 'California',
  })
  @IsString()
  @IsOptional()
  readonly stateProvince?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'United States',
  })
  @IsString()
  @IsOptional()
  readonly country?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact information',
    example: 'Jane Doe, +1-555-987-6543, relationship: sister',
  })
  @IsString()
  @IsOptional()
  readonly emergencyContact?: string;

  @ApiPropertyOptional({
    description: 'URL to user profile picture',
    example: 'https://example.com/profile.jpg',
  })
  @IsString()
  @IsOptional()
  readonly profilePicture?: string;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed to register for camps',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  readonly allowRegistration?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed early registration',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  readonly allowEarlyRegistration?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed to defer dues payment',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  readonly allowDeferredDuesPayment?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed to skip job assignments',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  readonly allowNoJob?: boolean;

  @ApiPropertyOptional({
    description: 'Internal notes about the user (admin only)',
    example: 'Previous volunteer coordinator',
  })
  @IsString()
  @IsOptional()
  readonly internalNotes?: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  @IsOptional()
  readonly role?: UserRole;
}