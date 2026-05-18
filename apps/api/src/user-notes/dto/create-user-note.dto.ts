import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Maximum allowed length for an internal user note.
 */
export const USER_NOTE_MAX_LENGTH = 4096;

/**
 * Data Transfer Object for creating a new internal note about a user.
 * The author is derived from the authenticated request; the subject user
 * is taken from the URL path.
 */
export class CreateUserNoteDto {
  @ApiProperty({
    description: 'Free-form note content',
    example: 'Confirmed payment via bank transfer.',
    maxLength: USER_NOTE_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty({ message: 'Note content is required' })
  @MaxLength(USER_NOTE_MAX_LENGTH, {
    message: `Note content must be at most ${USER_NOTE_MAX_LENGTH} characters long`,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content!: string;
}
