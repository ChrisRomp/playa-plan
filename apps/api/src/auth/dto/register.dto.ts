import { ApiProperty } from '@nestjs/swagger';
import { 
  IsEmail, 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  Matches,
  MaxLength, 
  MinLength 
} from 'class-validator';

/**
 * Data Transfer Object for user registration
 */
export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address of the user',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  readonly email: string = '';

  @ApiProperty({
    example: 'Password123!',
    description: 'The password for the account',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{8,}$/,
    {
      message: 'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number',
    },
  )
  readonly password: string = '';

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