import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for authentication response
 */
export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  readonly accessToken: string = '';

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User ID',
  })
  readonly userId: string = '';

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email',
  })
  readonly email: string = '';

  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  readonly firstName: string = '';

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  readonly lastName: string = '';

  @ApiProperty({
    example: 'PARTICIPANT',
    description: 'User role',
  })
  readonly role: string = '';
  
  constructor(partial: Partial<AuthResponseDto>) {
    Object.assign(this, partial);
  }
}