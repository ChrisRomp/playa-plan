import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { UserNotesController } from './user-notes.controller';
import { UserNotesService } from '../services/user-notes.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/guards/roles.guard';

describe('UserNotesController', () => {
  let controller: UserNotesController;
  let service: jest.Mocked<UserNotesService>;

  const adminReq = {
    user: { id: 'admin-1', email: 'a@a.com', role: UserRole.ADMIN },
  } as never;

  const makeNote = () => ({
    id: 'note-1',
    userId: 'user-1',
    authorId: 'staff-1',
    content: 'hi',
    createdAt: new Date('2026-05-18T00:00:00Z'),
    updatedAt: new Date('2026-05-18T00:00:00Z'),
    author: {
      id: 'staff-1',
      email: 's@s.com',
      firstName: 'Sara',
      lastName: 'Staff',
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserNotesController],
      providers: [
        {
          provide: UserNotesService,
          useValue: {
            listForUser: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(UserNotesController);
    service = module.get(UserNotesService) as jest.Mocked<UserNotesService>;
  });

  it('lists notes and returns entity instances with author projection', async () => {
    service.listForUser.mockResolvedValue([makeNote()]);

    const result = await controller.list('user-1');

    expect(service.listForUser).toHaveBeenCalledWith('user-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'note-1',
      userId: 'user-1',
      authorId: 'staff-1',
      content: 'hi',
      author: { id: 'staff-1', firstName: 'Sara' },
    });
  });

  it('creates a note using the authenticated user as author', async () => {
    service.create.mockResolvedValue(makeNote());

    const result = await controller.create(
      'user-1',
      { content: 'hi' },
      adminReq,
    );

    expect(service.create).toHaveBeenCalledWith('user-1', 'admin-1', {
      content: 'hi',
    });
    expect(result.id).toBe('note-1');
  });

  it('updates a note passing the actor role through', async () => {
    service.update.mockResolvedValue(makeNote());

    await controller.update('user-1', 'note-1', { content: 'x' }, adminReq);

    expect(service.update).toHaveBeenCalledWith(
      'user-1',
      'note-1',
      { id: 'admin-1', role: UserRole.ADMIN },
      { content: 'x' },
    );
  });

  it('deletes a note passing the actor role through', async () => {
    service.delete.mockResolvedValue(undefined);

    await controller.delete('user-1', 'note-1', adminReq);

    expect(service.delete).toHaveBeenCalledWith('user-1', 'note-1', {
      id: 'admin-1',
      role: UserRole.ADMIN,
    });
  });
});
