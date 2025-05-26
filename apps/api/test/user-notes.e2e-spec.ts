import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import { UserRole } from '@prisma/client';
import { CreateUserNoteDto } from '../src/users/dto/create-user-note.dto';

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  ...jest.requireActual('@prisma/client'),
  PrismaClient: jest.fn(() => ({
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userNote: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback()),
  })),
  UserRole: { ADMIN: 'ADMIN', STAFF: 'STAFF', PARTICIPANT: 'PARTICIPANT' },
}));

describe('UserNotes API (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockAdmin = {
    id: 'admin-id',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
  };

  const mockUser = {
    id: 'user-id',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.PARTICIPANT,
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
  ];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Apply validation pipe globally like in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/admin/users/:id/notes (GET)', () => {
    it('should not allow unauthenticated access', () => {
      return request(app.getHttpServer())
        .get(`/admin/users/${mockUser.id}/notes`)
        .expect(401);
    });

    it('should return notes for an admin user', async () => {
      // Mock user and note findUnique/findMany functions
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.userNote.findMany as jest.Mock).mockResolvedValue(mockNotes);

      // Create an admin token
      const adminToken = jwtService.sign({
        id: mockAdmin.id,
        email: mockAdmin.email,
        role: mockAdmin.role,
      });

      const response = await request(app.getHttpServer())
        .get(`/admin/users/${mockUser.id}/notes`)
        .set('Authorization', `******        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].userId).toBe(mockUser.id);
      expect(response.body[0].note).toBe(mockNotes[0].note);
    });

    it('should return 404 if user does not exist', async () => {
      // Mock user not found
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Create an admin token
      const adminToken = jwtService.sign({
        id: mockAdmin.id,
        email: mockAdmin.email,
        role: mockAdmin.role,
      });

      await request(app.getHttpServer())
        .get('/admin/users/non-existent-user/notes')
        .set('Authorization', `******        .expect(404);
    });
  });

  describe('/admin/users/:id/notes (POST)', () => {
    const createNoteDto: CreateUserNoteDto = {
      note: 'New test note',
    };

    it('should not allow unauthenticated access', () => {
      return request(app.getHttpServer())
        .post(`/admin/users/${mockUser.id}/notes`)
        .send(createNoteDto)
        .expect(401);
    });

    it('should create a note for an admin user', async () => {
      // Mock user findUnique and note create functions
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.userNote.create as jest.Mock).mockResolvedValue({
        id: 'new-note-id',
        userId: mockUser.id,
        note: createNoteDto.note,
        createdById: mockAdmin.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create an admin token
      const adminToken = jwtService.sign({
        id: mockAdmin.id,
        email: mockAdmin.email,
        role: mockAdmin.role,
      });

      const response = await request(app.getHttpServer())
        .post(`/admin/users/${mockUser.id}/notes`)
        .set('Authorization', `******        .send(createNoteDto)
        .expect(201);

      expect(response.body.userId).toBe(mockUser.id);
      expect(response.body.note).toBe(createNoteDto.note);
      expect(response.body.createdById).toBe(mockAdmin.id);
    });

    it('should return 404 if user does not exist', async () => {
      // Mock user not found
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Create an admin token
      const adminToken = jwtService.sign({
        id: mockAdmin.id,
        email: mockAdmin.email,
        role: mockAdmin.role,
      });

      await request(app.getHttpServer())
        .post('/admin/users/non-existent-user/notes')
        .set('Authorization', `******        .send(createNoteDto)
        .expect(404);
    });
  });

  describe('/admin/users/notes/:noteId (DELETE)', () => {
    it('should not allow unauthenticated access', () => {
      return request(app.getHttpServer())
        .delete('/admin/users/notes/note-id')
        .expect(401);
    });

    it('should allow an admin to delete a note', async () => {
      // Mock note findUnique and delete functions
      (prismaService.userNote.findUnique as jest.Mock).mockResolvedValue({
        ...mockNotes[0],
        createdBy: { role: UserRole.ADMIN },
      });
      (prismaService.userNote.delete as jest.Mock).mockResolvedValue(mockNotes[0]);

      // Create an admin token
      const adminToken = jwtService.sign({
        id: mockAdmin.id,
        email: mockAdmin.email,
        role: mockAdmin.role,
      });

      await request(app.getHttpServer())
        .delete('/admin/users/notes/note-1')
        .set('Authorization', `******        .expect(204);
    });

    it('should return 404 if note does not exist', async () => {
      // Mock note not found
      (prismaService.userNote.findUnique as jest.Mock).mockResolvedValue(null);

      // Create an admin token
      const adminToken = jwtService.sign({
        id: mockAdmin.id,
        email: mockAdmin.email,
        role: mockAdmin.role,
      });

      await request(app.getHttpServer())
        .delete('/admin/users/notes/non-existent-note')
        .set('Authorization', `******        .expect(404);
    });
  });
});