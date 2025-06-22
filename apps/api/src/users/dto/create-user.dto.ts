import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';
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
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName!: string;

  @ApiPropertyOptional({
    description: 'User playa name (optional)',
    example: 'Dusty',
  })
  @IsString()
  @IsOptional()
  playaName?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1-555-123-4567',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'San Francisco',
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    description: 'State or province',
    example: 'California',
  })
  @IsString()
  @IsOptional()
  stateProvince?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'United States',
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact information',
    example: 'Jane Doe, +1-555-987-6543, relationship: sister',
  })
  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @ApiPropertyOptional({
    description: 'URL to user profile picture',
    example: 'https://mycamp.playaplan.app/profile.jpg',
  })
  @IsString()
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
  })
  @IsString()
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