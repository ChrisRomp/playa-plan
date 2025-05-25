import { Test, TestingModule } from '@nestjs/testing';
import { UserNotesController } from './user-notes.controller';
import { UserNotesService } from '../services/user-notes.service';
import { UserRole } from '@prisma/client';
import { CreateUserNoteDto } from '../dto/create-user-note.dto';
import { UserNoteResponseDto } from '../dto/user-note-response.dto';

describe('UserNotesController', () => {
  let controller: UserNotesController;
  let userNotesService: UserNotesService;

  // Mock data
  const userId = 'user-id';
  const creatorId = 'admin-id';
  const noteId = 'note-id';
  
  const mockNote = {
    id: noteId,
    userId: userId,
    note: 'Test note',
    createdById: creatorId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const mockNoteResponseDto: UserNoteResponseDto = {
    ...mockNote,
    creatorFirstName: 'Admin',
    creatorLastName: 'User',
  };

  // Mock request object
  const mockRequest = {
    user: {
      id: creatorId,
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    },
  };

  // Create mock service
  const mockUserNotesService = {
    findAllByUserId: jest.fn().mockImplementation(() => Promise.resolve([mockNoteResponseDto])),
    create: jest.fn().mockImplementation(() => Promise.resolve(mockNote)),
    delete: jest.fn().mockImplementation(() => Promise.resolve()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserNotesController],
      providers: [
        {
          provide: UserNotesService,
          useValue: mockUserNotesService,
        },
      ],
    }).compile();

    controller = module.get<UserNotesController>(UserNotesController);
    userNotesService = module.get<UserNotesService>(UserNotesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAllNotes', () => {
    it('should return an array of user notes', async () => {
      const result = await controller.findAllNotes(userId);
      
      expect(userNotesService.findAllByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual([mockNoteResponseDto]);
    });
  });

  describe('create', () => {
    it('should create a new note', async () => {
      const createNoteDto: CreateUserNoteDto = {
        note: 'Test note',
      };
      
      const result = await controller.create(userId, createNoteDto, mockRequest);
      
      expect(userNotesService.create).toHaveBeenCalledWith(userId, createNoteDto, mockRequest.user.id);
      expect(result).toEqual(mockNote);
    });
  });

  describe('delete', () => {
    it('should delete a note', async () => {
      await controller.delete(noteId, mockRequest);
      
      expect(userNotesService.delete).toHaveBeenCalledWith(
        noteId, 
        mockRequest.user.id,
        mockRequest.user.role
      );
    });
  });
});