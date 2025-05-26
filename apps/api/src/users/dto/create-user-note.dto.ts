import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Data Transfer Object for creating a user note
 */
export class CreateUserNoteDto {
  @ApiProperty({
    description: 'Note content',
    example: 'User reported login issues, provided temporary workaround',
    maxLength: 1024,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024, { message: 'Note must be at most 1024 characters long' })
  readonly note: string;
}