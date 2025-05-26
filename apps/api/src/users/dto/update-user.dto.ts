import { IsEmail, IsEnum, IsOptional, IsString, MinLength, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * Data Transfer Object for updating a user
 * All fields are optional since updates may only include some fields
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User email address',
    example: 'user@example.playaplan.app',
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
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50, { message: 'First name must be at most 50 characters long' })
  @IsOptional()
  readonly firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50, { message: 'Last name must be at most 50 characters long' })
  @IsOptional()
  readonly lastName?: string;

  @ApiPropertyOptional({
    description: 'User playa name',
    example: 'Dusty',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50, { message: 'Playa name must be at most 50 characters long' })
  @IsOptional()
  readonly playaName?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1-555-123-4567',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50, { message: 'Phone number must be at most 50 characters long' })
  @IsOptional()
  readonly phone?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'San Francisco',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50, { message: 'City must be at most 50 characters long' })
  @IsOptional()
  readonly city?: string;

  @ApiPropertyOptional({
    description: 'State or province',
    example: 'CA',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50, { message: 'State/province must be at most 50 characters long' })
  @IsOptional()
  readonly stateProvince?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'United States',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50, { message: 'Country must be at most 50 characters long' })
  @IsOptional()
  readonly country?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact information',
    example: 'Jane Doe, +1-555-987-6543, relationship: sister',
    maxLength: 1024,
  })
  @IsString()
  @MaxLength(1024, { message: 'Emergency contact must be at most 1024 characters long' })
  @IsOptional()
  readonly emergencyContact?: string;

  @ApiPropertyOptional({
    description: 'URL to user profile picture',
    example: 'https://mycamp.playaplan.app/profile.jpg',
    maxLength: 1024,
  })
  @IsString()
  @MaxLength(1024, { message: 'Profile picture URL must be at most 1024 characters long' })
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
    description: 'User role',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  @IsOptional()
  readonly role?: UserRole;
}