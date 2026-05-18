import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserNotesService } from './user-notes.service';

type MockPrismaService = {
  user: {
    findUnique: jest.Mock;
  };
  userNote: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    groupBy: jest.Mock;
  };
};

const adminActor = { id: 'admin-1', role: UserRole.ADMIN };
const staffActor = { id: 'staff-1', role: UserRole.STAFF };
const otherStaffActor = { id: 'staff-2', role: UserRole.STAFF };

const authorSelectFields = {
  id: 'staff-1',
  email: 'staff@example.playaplan.app',
  firstName: 'Sara',
  lastName: 'Staff',
};

const makeNote = (overrides: Partial<{ id: string; userId: string; authorId: string; content: string }> = {}) => ({
  id: overrides.id ?? 'note-1',
  userId: overrides.userId ?? 'user-1',
  authorId: overrides.authorId ?? 'staff-1',
  content: overrides.content ?? 'A note',
  createdAt: new Date('2026-05-18T00:00:00Z'),
  updatedAt: new Date('2026-05-18T00:00:00Z'),
});

const makeNoteWithAuthor = (overrides: Partial<{ id: string; userId: string; authorId: string; content: string }> = {}) => ({
  ...makeNote(overrides),
  author: authorSelectFields,
});

describe('UserNotesService', () => {
  let service: UserNotesService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      userNote: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue(undefined),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserNotesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UserNotesService>(UserNotesService);
  });

  describe('listForUser', () => {
    it('returns notes for the user ordered by createdAt desc with author projection', async () => {
      const notes = [makeNoteWithAuthor()];
      prisma.userNote.findMany.mockResolvedValue(notes);

      const result = await service.listForUser('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true },
      });
      expect(prisma.userNote.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
      expect(result).toEqual(notes);
    });

    it('throws NotFoundException if the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.listForUser('missing')).rejects.toThrow(NotFoundException);
      expect(prisma.userNote.findMany).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a note for the user with the actor as author', async () => {
      const created = makeNoteWithAuthor();
      prisma.userNote.create.mockResolvedValue(created);

      const result = await service.create('user-1', 'staff-1', {
        content: 'A note',
      });

      expect(prisma.userNote.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', authorId: 'staff-1', content: 'A note' },
        include: {
          author: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
      expect(result).toBe(created);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.create('missing', 'staff-1', { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.userNote.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a note when the actor is the author', async () => {
      prisma.userNote.findUnique.mockResolvedValue(
        makeNote({ authorId: staffActor.id }),
      );
      const updated = makeNoteWithAuthor({ content: 'updated' });
      prisma.userNote.update.mockResolvedValue(updated);

      const result = await service.update('user-1', 'note-1', staffActor, {
        content: 'updated',
      });

      expect(prisma.userNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: { content: 'updated' },
        include: {
          author: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
      expect(result).toBe(updated);
    });

    it('forbids admins from editing notes authored by another user', async () => {
      prisma.userNote.findUnique.mockResolvedValue(
        makeNote({ authorId: 'someone-else' }),
      );

      await expect(
        service.update('user-1', 'note-1', adminActor, { content: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.userNote.update).not.toHaveBeenCalled();
    });

    it('allows an admin to edit their own note', async () => {
      prisma.userNote.findUnique.mockResolvedValue(
        makeNote({ authorId: adminActor.id }),
      );
      prisma.userNote.update.mockResolvedValue(makeNoteWithAuthor());

      await expect(
        service.update('user-1', 'note-1', adminActor, { content: 'x' }),
      ).resolves.toBeDefined();
    });

    it('forbids staff from editing notes authored by another staff member', async () => {
      prisma.userNote.findUnique.mockResolvedValue(
        makeNote({ authorId: staffActor.id }),
      );

      await expect(
        service.update('user-1', 'note-1', otherStaffActor, { content: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.userNote.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the note does not belong to the user', async () => {
      prisma.userNote.findUnique.mockResolvedValue(
        makeNote({ userId: 'other-user' }),
      );

      await expect(
        service.update('user-1', 'note-1', staffActor, { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the note does not exist', async () => {
      prisma.userNote.findUnique.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'missing', staffActor, { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes a note when the actor is the author', async () => {
      prisma.userNote.findUnique.mockResolvedValue(
        makeNote({ authorId: staffActor.id }),
      );

      await service.delete('user-1', 'note-1', staffActor);

      expect(prisma.userNote.delete).toHaveBeenCalledWith({
        where: { id: 'note-1' },
      });
    });

    it('forbids non-author staff from deleting a note', async () => {
      prisma.userNote.findUnique.mockResolvedValue(
        makeNote({ authorId: staffActor.id }),
      );

      await expect(
        service.delete('user-1', 'note-1', otherStaffActor),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.userNote.delete).not.toHaveBeenCalled();
    });

    it('allows admins to delete a note authored by another user', async () => {
      prisma.userNote.findUnique.mockResolvedValue(
        makeNote({ authorId: 'someone-else' }),
      );

      await service.delete('user-1', 'note-1', adminActor);
      expect(prisma.userNote.delete).toHaveBeenCalled();
    });
  });

  describe('countByUserIds', () => {
    it('returns an empty map when given no ids', async () => {
      const result = await service.countByUserIds([]);
      expect(result.size).toBe(0);
      expect(prisma.userNote.groupBy).not.toHaveBeenCalled();
    });

    it('returns counts keyed by userId', async () => {
      prisma.userNote.groupBy.mockResolvedValue([
        { userId: 'user-1', _count: { _all: 3 } },
        { userId: 'user-2', _count: { _all: 1 } },
      ]);

      const result = await service.countByUserIds(['user-1', 'user-2', 'user-3']);

      expect(result.get('user-1')).toBe(3);
      expect(result.get('user-2')).toBe(1);
      expect(result.has('user-3')).toBe(false);
    });
  });
});
