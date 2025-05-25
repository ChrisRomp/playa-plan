import { ApiProperty } from '@nestjs/swagger';
import { UserNote as PrismaUserNote } from '@prisma/client';

/**
 * Entity representing a user note in the system
 * Maps to the UserNote model in Prisma
 */
export class UserNote implements PrismaUserNote {
  @ApiProperty({ description: 'Unique identifier for the note' })
  id: string;

  @ApiProperty({ description: 'ID of the user this note is about' })
  userId: string;

  @ApiProperty({ description: 'The note content' })
  note: string;

  @ApiProperty({ description: 'ID of the user who created this note' })
  createdById: string;

  @ApiProperty({ description: 'When the note was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When the note was last updated' })
  updatedAt: Date;

  constructor(partial: Partial<UserNote>) {
    Object.assign(this, partial);
  }
}