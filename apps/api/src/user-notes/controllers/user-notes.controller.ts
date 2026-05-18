import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateUserNoteDto } from '../dto/create-user-note.dto';
import { UpdateUserNoteDto } from '../dto/update-user-note.dto';
import { UserNote } from '../entities/user-note.entity';
import {
  UserNotesService,
  UserNoteWithAuthor,
} from '../services/user-notes.service';

interface AuthRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

/**
 * REST endpoints for managing internal notes about users.
 *
 * All endpoints require STAFF or ADMIN role. Participant-level callers
 * never see notes data and never have an endpoint to query it.
 */
@ApiTags('user-notes')
@ApiBearerAuth()
@Controller('users/:userId/notes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
export class UserNotesController {
  constructor(private readonly userNotesService: UserNotesService) {}

  /**
   * List all internal notes for a user, newest first.
   */
  @Get()
  @ApiOperation({ summary: 'List internal notes for a user' })
  @ApiParam({ name: 'userId', description: 'Subject user ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the list of notes',
    type: UserNote,
    isArray: true,
  })
  @ApiResponse({ status: 403, description: 'Forbidden — staff/admin only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async list(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<UserNote[]> {
    const notes = await this.userNotesService.listForUser(userId);
    return notes.map(toEntity);
  }

  /**
   * Create a new internal note. The authenticated user is recorded as
   * the author.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new internal note' })
  @ApiParam({ name: 'userId', description: 'Subject user ID' })
  @ApiResponse({
    status: 201,
    description: 'Note created successfully',
    type: UserNote,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 403, description: 'Forbidden — staff/admin only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async create(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: CreateUserNoteDto,
    @Request() req: AuthRequest,
  ): Promise<UserNote> {
    const note = await this.userNotesService.create(userId, req.user.id, dto);
    return toEntity(note);
  }

  /**
   * Update the content of an existing note. Only the original author may
   * edit a note — admins cannot edit notes authored by other users so that
   * attribution is preserved. To remove an objectionable note authored by
   * someone else, an admin must delete it.
   */
  @Patch(':noteId')
  @ApiOperation({ summary: 'Update an internal note' })
  @ApiParam({ name: 'userId', description: 'Subject user ID' })
  @ApiParam({ name: 'noteId', description: 'Note ID' })
  @ApiResponse({
    status: 200,
    description: 'Note updated successfully',
    type: UserNote,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — only the original author may edit a note',
  })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async update(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('noteId', new ParseUUIDPipe()) noteId: string,
    @Body() dto: UpdateUserNoteDto,
    @Request() req: AuthRequest,
  ): Promise<UserNote> {
    const note = await this.userNotesService.update(
      userId,
      noteId,
      { id: req.user.id, role: req.user.role },
      dto,
    );
    return toEntity(note);
  }

  /**
   * Delete a note. Only the original author or an administrator may
   * delete a note.
   */
  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an internal note' })
  @ApiParam({ name: 'userId', description: 'Subject user ID' })
  @ApiParam({ name: 'noteId', description: 'Note ID' })
  @ApiResponse({ status: 204, description: 'Note deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — staff can only delete their own notes',
  })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async delete(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('noteId', new ParseUUIDPipe()) noteId: string,
    @Request() req: AuthRequest,
  ): Promise<void> {
    await this.userNotesService.delete(userId, noteId, {
      id: req.user.id,
      role: req.user.role,
    });
  }
}

function toEntity(note: UserNoteWithAuthor): UserNote {
  return new UserNote({
    id: note.id,
    userId: note.userId,
    authorId: note.authorId,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    author: note.author
      ? {
          id: note.author.id,
          email: note.author.email,
          firstName: note.author.firstName,
          lastName: note.author.lastName,
        }
      : undefined,
  });
}
