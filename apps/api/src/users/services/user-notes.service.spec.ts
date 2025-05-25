import { Test, TestingModule } from '@nestjs/testing';
import { UserNotesService } from './user-notes.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// Mock data
const mockUser = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
};

const mockAdmin = {
  id: 'admin-1',
  firstName: 'Admin',
  lastName: 'User',
  role: UserRole.ADMIN,
};

const mockStaff = {
  id: 'staff-1',
  firstName: 'Staff',
  lastName: 'User',
  role: UserRole.STAFF,
};

const mockNotes = [
  {
    id: 'note-1',
    userId: mockUser.id,
    note: 'Test note 1',
    createdById: mockAdmin.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: {
      firstName: mockAdmin.firstName,
      lastName: mockAdmin.lastName,
    },
  },
  {
    id: 'note-2',
    userId: mockUser.id,
    note: 'Test note 2',
    createdById: mockStaff.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: {
      firstName: mockStaff.firstName,
      lastName: mockStaff.lastName,
    },
  },
];

// Create a mock PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  userNote: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

describe('UserNotesService', () => {
  let service: UserNotesService;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserNotesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserNotesService>(UserNotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByUserId', () => {
    it('should return all notes for a user', async () => {
      // Mock user existence check
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      
      // Mock finding notes
      mockPrismaService.userNote.findMany.mockResolvedValue(mockNotes);

      const result = await service.findAllByUserId(mockUser.id);
      
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: { id: true },
      });
      
      expect(mockPrismaService.userNote.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
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

      // Check that the response is transformed correctly
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('creatorFirstName', mockAdmin.firstName);
      expect(result[0]).toHaveProperty('creatorLastName', mockAdmin.lastName);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Mock user not found
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findAllByUserId('non-existent-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createNoteDto = { note: 'New test note' };

    it('should create a note for a user', async () => {
      // Mock user existence check
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      
      // Mock note creation
      const newNote = {
        id: 'new-note-id',
        userId: mockUser.id,
        note: createNoteDto.note,
        createdById: mockAdmin.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.userNote.create.mockResolvedValue(newNote);

      const result = await service.create(mockUser.id, createNoteDto, mockAdmin.id);
      
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: { id: true },
      });
      
      expect(mockPrismaService.userNote.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          note: createNoteDto.note,
          createdById: mockAdmin.id,
        },
      });

      expect(result).toEqual(newNote);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Mock user not found
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create('non-existent-user', createNoteDto, mockAdmin.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should allow admin to delete any note', async () => {
      // Mock finding the note
      const noteToDelete = {
        ...mockNotes[0],
        createdBy: {
          role: UserRole.STAFF,
        },
      };
      mockPrismaService.userNote.findUnique.mockResolvedValue(noteToDelete);
      
      // Mock note deletion
      mockPrismaService.userNote.delete.mockResolvedValue(noteToDelete);

      // Admin should be able to delete any note
      await expect(service.delete(noteToDelete.id, mockAdmin.id, UserRole.ADMIN)).resolves.toEqual(noteToDelete);
      
      expect(mockPrismaService.userNote.delete).toHaveBeenCalledWith({
        where: { id: noteToDelete.id },
      });
    });

    it('should allow note creator to delete their own note', async () => {
      // Mock finding the note
      const noteToDelete = {
        ...mockNotes[1],
        createdBy: {
          role: UserRole.STAFF,
        },
      };
      mockPrismaService.userNote.findUnique.mockResolvedValue(noteToDelete);
      
      // Mock note deletion
      mockPrismaService.userNote.delete.mockResolvedValue(noteToDelete);

      // Creator should be able to delete their own note
      await expect(service.delete(noteToDelete.id, mockStaff.id, UserRole.STAFF)).resolves.toEqual(noteToDelete);
    });

    it('should allow staff to delete notes created by non-admin', async () => {
      // Mock finding the note created by staff
      const noteToDelete = {
        ...mockNotes[1],
        createdBy: {
          role: UserRole.STAFF,
        },
      };
      mockPrismaService.userNote.findUnique.mockResolvedValue(noteToDelete);
      
      // Mock note deletion
      mockPrismaService.userNote.delete.mockResolvedValue(noteToDelete);

      // Staff should be able to delete notes created by non-admin users
      await expect(service.delete(noteToDelete.id, 'staff-2', UserRole.STAFF)).resolves.toEqual(noteToDelete);
    });

    it('should not allow staff to delete notes created by admin', async () => {
      // Mock finding the note created by admin
      const noteToDelete = {
        ...mockNotes[0],
        createdBy: {
          role: UserRole.ADMIN,
        },
      };
      mockPrismaService.userNote.findUnique.mockResolvedValue(noteToDelete);

      // Staff should not be able to delete notes created by admin
      await expect(service.delete(noteToDelete.id, mockStaff.id, UserRole.STAFF)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if note does not exist', async () => {
      // Mock note not found
      mockPrismaService.userNote.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent-note', mockAdmin.id, UserRole.ADMIN)).rejects.toThrow(NotFoundException);
    });
  });
});