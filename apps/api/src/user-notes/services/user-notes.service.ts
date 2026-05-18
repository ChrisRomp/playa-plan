import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserNote as PrismaUserNote, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserNoteDto } from '../dto/create-user-note.dto';
import { UpdateUserNoteDto } from '../dto/update-user-note.dto';

/**
 * Minimal author projection returned alongside a note.
 * Limited to non-sensitive fields suitable for staff/admin display.
 */
const AUTHOR_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

const NOTE_INCLUDE = {
  author: { select: AUTHOR_SELECT },
} satisfies Prisma.UserNoteInclude;

export type UserNoteWithAuthor = PrismaUserNote & {
  author: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

/**
 * Service for managing internal notes about users.
 *
 * Notes are authored by staff/admin users and are visible only to other
 * staff/admin users. Participant-level endpoints never surface this data.
 */
@Injectable()
export class UserNotesService {
  private readonly logger = new Logger(UserNotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all notes for a given user, newest first.
   * Throws NotFoundException if the user does not exist.
   */
  async listForUser(userId: string): Promise<UserNoteWithAuthor[]> {
    await this.assertUserExists(userId);

    return this.prisma.userNote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: NOTE_INCLUDE,
    }) as Promise<UserNoteWithAuthor[]>;
  }

  /**
   * Create a new note attached to a user.
   *
   * @param userId - The user the note is about
   * @param authorId - The authenticated staff/admin user creating the note
   * @param dto - Note content
   */
  async create(
    userId: string,
    authorId: string,
    dto: CreateUserNoteDto,
  ): Promise<UserNoteWithAuthor> {
    await this.assertUserExists(userId);

    const created = await this.prisma.userNote.create({
      data: {
        userId,
        authorId,
        content: dto.content,
      },
      include: NOTE_INCLUDE,
    });
    this.logger.log(
      `User note ${created.id} created for user ${userId} by ${authorId}`,
    );
    return created as UserNoteWithAuthor;
  }

  /**
   * Update an existing note's content.
   *
   * Only the original author may edit a note. Admins cannot edit notes
   * authored by another user — content attribution is preserved.
   * The note must belong to the specified user (URL-path scoping).
   */
  async update(
    userId: string,
    noteId: string,
    actor: { id: string; role: UserRole },
    dto: UpdateUserNoteDto,
  ): Promise<UserNoteWithAuthor> {
    const note = await this.findOneScoped(userId, noteId);
    this.assertCanEdit(note, actor);

    const updated = await this.prisma.userNote.update({
      where: { id: noteId },
      data: { content: dto.content },
      include: NOTE_INCLUDE,
    });
    this.logger.log(`User note ${noteId} updated by ${actor.id}`);
    return updated as UserNoteWithAuthor;
  }

  /**
   * Delete a note.
   *
   * The original author may delete their own note; ADMINs may delete any note.
   * The note must belong to the specified user (URL-path scoping).
   */
  async delete(
    userId: string,
    noteId: string,
    actor: { id: string; role: UserRole },
  ): Promise<void> {
    const note = await this.findOneScoped(userId, noteId);
    this.assertCanDelete(note, actor);

    await this.prisma.userNote.delete({ where: { id: noteId } });
    this.logger.log(`User note ${noteId} deleted by ${actor.id}`);
  }

  /**
   * Count notes per user for the given user IDs.
   * Returns a Map keyed by userId; users without notes are omitted.
   */
  async countByUserIds(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const grouped = await this.prisma.userNote.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    });

    const counts = new Map<string, number>();
    for (const row of grouped) {
      counts.set(row.userId, row._count._all);
    }
    return counts;
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private async findOneScoped(
    userId: string,
    noteId: string,
  ): Promise<PrismaUserNote> {
    const note = await this.prisma.userNote.findUnique({
      where: { id: noteId },
    });
    if (!note || note.userId !== userId) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  private assertCanEdit(
    note: PrismaUserNote,
    actor: { id: string; role: UserRole },
  ): void {
    if (note.authorId !== actor.id) {
      throw new ForbiddenException(
        'Only the original author can edit this note',
      );
    }
  }

  private assertCanDelete(
    note: PrismaUserNote,
    actor: { id: string; role: UserRole },
  ): void {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (note.authorId !== actor.id) {
      throw new ForbiddenException(
        'Only the original author or an administrator can delete this note',
      );
    }
  }
}
