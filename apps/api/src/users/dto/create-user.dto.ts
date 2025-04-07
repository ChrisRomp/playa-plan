import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * Data Transfer Object for creating a new user
 */
export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    description: 'User password',
    example: 'Secure123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;

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
    description: 'User role',
    enum: UserRole,
    default: UserRole.PARTICIPANT,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.PARTICIPANT;
}