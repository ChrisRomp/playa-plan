import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { USER_NOTE_MAX_LENGTH } from './create-user-note.dto';

/**
 * Data Transfer Object for updating an existing internal note.
 * Only the note content can be updated. The author is preserved.
 */
export class UpdateUserNoteDto {
  @ApiProperty({
    description: 'Updated note content',
    example: 'Updated: confirmed payment via bank transfer on 2026-05-18.',
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
