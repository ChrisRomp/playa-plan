import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * Data Transfer Object for creating a new user
 */
export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.playaplan.app',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;


  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'First name must be at least 1 character long' })
  @IsNotEmpty({ message: 'First name is required' })
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'Last name must be at least 1 character long' })
  @IsNotEmpty({ message: 'Last name is required' })
  lastName!: string;

  @ApiPropertyOptional({
    description: 'User playa name (optional)',
    example: 'Dusty',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'Playa name must be at least 1 character long' })
  @IsOptional()
  playaName?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1-555-123-4567',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'Phone number must be at least 1 character long' })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'San Francisco',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'City must be at least 1 character long' })
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    description: 'State or province',
    example: 'California',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'State/province must be at least 1 character long' })
  @IsOptional()
  stateProvince?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'United States',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'Country must be at least 1 character long' })
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact information',
    example: 'Jane Doe, +1-555-987-6543, relationship: sister',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'Emergency contact must be at least 1 character long' })
  @IsOptional()
  emergencyContact?: string;

  @ApiPropertyOptional({
    description: 'URL to user profile picture',
    example: 'https://mycamp.playaplan.app/profile.jpg',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'Profile picture URL must be at least 1 character long' })
  @IsOptional()
  profilePicture?: string;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed to register for camps',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  allowRegistration?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed early registration',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  allowEarlyRegistration?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed to defer dues payment',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  allowDeferredDuesPayment?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is allowed to skip job assignments',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  allowNoJob?: boolean;

  @ApiPropertyOptional({
    description: 'Internal notes about the user (admin only)',
    example: 'Previous volunteer coordinator',
    minLength: 1,
  })
  @IsString()
  @MinLength(1, { message: 'Internal notes must be at least 1 character long' })
  @IsOptional()
  internalNotes?: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
    default: UserRole.PARTICIPANT,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.PARTICIPANT;
}