import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserNoteDto } from '../dto/create-user-note.dto';
import { UserNote } from '../entities/user-note.entity';
import { UserNoteResponseDto } from '../dto/user-note-response.dto';
import { UserRole } from '@prisma/client';

/**
 * Service for handling user note related operations
 */
@Injectable()
export class UserNotesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all notes for a specific user
   * @param userId - The ID of the user whose notes to retrieve
   * @returns Array of user notes with creator details
   */
  async findAllByUserId(userId: string): Promise<UserNoteResponseDto[]> {
    // Check if user exists first
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!userExists) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const notes = await this.prisma.userNote.findMany({
      where: { userId },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform data to include creator information
    return notes.map(note => ({
      ...note,
      creatorFirstName: note.createdBy.firstName,
      creatorLastName: note.createdBy.lastName
    }));
  }

  /**
   * Create a new note for a user
   * @param userId - The ID of the user for whom to create the note
   * @param createUserNoteDto - The note data
   * @param createdById - The ID of the user creating the note
   * @returns The newly created note
   */
  async create(userId: string, createUserNoteDto: CreateUserNoteDto, createdById: string): Promise<UserNote> {
    // Check if user exists first
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!userExists) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Create the note
    return this.prisma.userNote.create({
      data: {
        userId,
        note: createUserNoteDto.note,
        createdById
      }
    });
  }

  /**
   * Delete a note by ID
   * @param noteId - The ID of the note to delete
   * @param currentUserId - The ID of the user attempting to delete the note
   * @returns The deleted note
   */
  async delete(noteId: string, currentUserId: string, currentUserRole: UserRole): Promise<UserNote> {
    const note = await this.prisma.userNote.findUnique({
      where: { id: noteId },
      include: { createdBy: { select: { role: true } } }
    });
    
    if (!note) {
      throw new NotFoundException(`Note with ID ${noteId} not found`);
    }

    // Allow deletion if:
    // 1. The user is the creator of the note
    // 2. The user is an admin
    // 3. The user is staff and the note was created by a non-admin
    const isCreator = note.createdById === currentUserId;
    const isAdmin = currentUserRole === UserRole.ADMIN;
    const isStaffDeletingNonAdmin = 
      currentUserRole === UserRole.STAFF && 
      note.createdBy.role !== UserRole.ADMIN;

    if (!isCreator && !isAdmin && !isStaffDeletingNonAdmin) {
      throw new ForbiddenException('You do not have permission to delete this note');
    }
    
    return this.prisma.userNote.delete({
      where: { id: noteId }
    });
  }
}