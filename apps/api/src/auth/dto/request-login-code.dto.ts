import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for requesting a login verification code
 */
export class RequestLoginCodeDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.playaplan.app',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
} 