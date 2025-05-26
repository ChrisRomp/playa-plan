import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
  UseInterceptors,
  ClassSerializerInterceptor,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserNotesService } from '../services/user-notes.service';
import { CreateUserNoteDto } from '../dto/create-user-note.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UserNote } from '../entities/user-note.entity';
import { UserNoteResponseDto } from '../dto/user-note-response.dto';

/**
 * Type definition for authenticated request
 */
interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

/**
 * Controller for handling user note-related HTTP requests
 */
@ApiTags('user-notes')
@Controller('admin/users')
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class UserNotesController {
  constructor(private readonly userNotesService: UserNotesService) {}

  /**
   * Get all notes for a specific user
   */
  @Get(':id/notes')
  @ApiOperation({ summary: 'Get all notes for a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns all notes for the user',
    type: UserNoteResponseDto,
    isArray: true
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient privileges' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findAllNotes(@Param('id') id: string): Promise<UserNoteResponseDto[]> {
    return this.userNotesService.findAllByUserId(id);
  }

  /**
   * Create a new note for a user
   */
  @Post(':id/notes')
  @ApiOperation({ summary: 'Create a note for a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ 
    status: 201, 
    description: 'Note created successfully',
    type: UserNote
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient privileges' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async create(
    @Param('id') userId: string,
    @Body() createUserNoteDto: CreateUserNoteDto,
    @Request() req: AuthRequest
  ): Promise<UserNote> {
    return this.userNotesService.create(userId, createUserNoteDto, req.user.id);
  }

  /**
   * Delete a note
   */
  @Delete('/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a note' })
  @ApiParam({ name: 'noteId', description: 'Note ID' })
  @ApiResponse({ status: 204, description: 'Note deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient privileges' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async delete(
    @Param('noteId') noteId: string,
    @Request() req: AuthRequest
  ): Promise<void> {
    await this.userNotesService.delete(noteId, req.user.id, req.user.role);
  }
}