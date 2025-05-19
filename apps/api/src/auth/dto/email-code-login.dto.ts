import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for email code verification login
 */
export class EmailCodeLoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.playaplan.app',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    description: 'Verification code sent to email',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  code!: string;
} 