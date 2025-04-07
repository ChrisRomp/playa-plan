import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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
    description: 'URL to user profile picture',
    example: 'https://example.com/profile.jpg',
  })
  @IsString()
  @IsOptional()
  readonly profilePicture?: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  @IsOptional()
  readonly role?: UserRole;
}