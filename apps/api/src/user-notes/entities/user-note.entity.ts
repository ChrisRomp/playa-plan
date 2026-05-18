import { ApiProperty } from '@nestjs/swagger';

/**
 * Minimal author summary attached to a user note response.
 * Intentionally limited to non-sensitive fields suitable for staff/admin
 * display.
 */
export class UserNoteAuthor {
  @ApiProperty({ description: 'Author user ID' })
  id!: string;

  @ApiProperty({ description: 'Author email address' })
  email!: string;

  @ApiProperty({ description: 'Author first name' })
  firstName!: string;

  @ApiProperty({ description: 'Author last name' })
  lastName!: string;
}

/**
 * Entity representing an internal note about a user.
 * Visible only to STAFF and ADMIN users.
 */
export class UserNote {
  @ApiProperty({ description: 'Unique identifier for the note' })
  id!: string;

  @ApiProperty({ description: 'ID of the user the note is about' })
  userId!: string;

  @ApiProperty({ description: 'ID of the staff/admin user who authored the note' })
  authorId!: string;

  @ApiProperty({ description: 'Free-form note content' })
  content!: string;

  @ApiProperty({ description: 'When the note was created' })
  createdAt!: Date;

  @ApiProperty({ description: 'When the note was last updated' })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Summary of the staff/admin user who authored the note',
    type: UserNoteAuthor,
    required: false,
  })
  author?: UserNoteAuthor;

  constructor(partial: Partial<UserNote>) {
    Object.assign(this, partial);
  }
}
