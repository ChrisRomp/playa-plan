import { ApiProperty } from '@nestjs/swagger';
import { 
  IsEmail, 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  MaxLength 
} from 'class-validator';

/**
 * Data Transfer Object for user registration
 */
export class RegisterDto {
  @ApiProperty({
    example: 'user@example.playaplan.app',
    description: 'The email address of the user',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  readonly email: string = '';

  // Password is not required as we use email verification

  @ApiProperty({
    example: 'John',
    description: 'The first name of the user',
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters' })
  readonly firstName: string = '';

  @ApiProperty({
    example: 'Doe',
    description: 'The last name of the user',
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters' })
  readonly lastName: string = '';

  @ApiProperty({
    example: 'Sparky',
    description: 'The playa name of the user',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Playa name cannot exceed 50 characters' })
  readonly playaName?: string;
  
  constructor(partial: Partial<RegisterDto>) {
    Object.assign(this, partial);
  }
}