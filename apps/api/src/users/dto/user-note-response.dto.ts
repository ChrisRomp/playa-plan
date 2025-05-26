import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for user note response with creator details
 */
export class UserNoteResponseDto {
  @ApiProperty({ description: 'Unique identifier for the note' })
  id: string;

  @ApiProperty({ description: 'ID of the user this note is about' })
  userId: string;

  @ApiProperty({ description: 'The note content' })
  note: string;

  @ApiProperty({ description: 'ID of the user who created this note' })
  createdById: string;

  @ApiProperty({ description: 'Creator first name' })
  creatorFirstName?: string;

  @ApiProperty({ description: 'Creator last name' })
  creatorLastName?: string;

  @ApiProperty({ description: 'When the note was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When the note was last updated' })
  updatedAt: Date;
}