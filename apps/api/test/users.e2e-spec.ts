import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prismaMock: any;

  const mockUser = {
    id: 'test-uuid-e2e',
    email: 'test-e2e@example.com',
    password: 'hashed_password',
    firstName: 'Test',
    lastName: 'User',
    playaName: null,
    profilePicture: null,
    role: UserRole.PARTICIPANT,
    isEmailVerified: false,
    verificationToken: null,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    // Create a proper Prisma mock with all required methods
    prismaMock = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $transaction: jest.fn(),
    };
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .compile();

    app = moduleFixture.createNestApplication();
    
    // Apply the same global pipes as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/users (GET)', () => {
    it('should return an array of users', () => {
      // Arrange
      prismaMock.user.findMany.mockResolvedValue([mockUser]);

      // Act & Assert
      return request(app.getHttpServer())
        .get('/users')
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBeTruthy();
          expect(res.body.length).toBe(1);
          expect(res.body[0].email).toBe(mockUser.email);
        });
    });
  });

  describe('/users/:id (GET)', () => {
    it('should return a user by ID', () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      return request(app.getHttpServer())
        .get(`/users/${mockUser.id}`)
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe(mockUser.id);
          expect(res.body.email).toBe(mockUser.email);
        });
    });

    it('should return 404 if user not found', () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      return request(app.getHttpServer())
        .get('/users/non-existent-id')
        .expect(404);
    });
  });

  describe('/users (POST)', () => {
    it('should create a new user', () => {
      // Arrange
      const createUserDto = {
        email: 'new-e2e@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };

      const createdUser = {
        ...mockUser,
        id: 'new-user-id',
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      };

      prismaMock.user.findUnique.mockResolvedValue(null); // User doesn't exist yet
      prismaMock.user.create.mockResolvedValue(createdUser);

      // Act & Assert
      return request(app.getHttpServer())
        .post('/users')
        .send(createUserDto)
        .expect(201)
        .expect(res => {
          expect(res.body.email).toBe(createUserDto.email);
          expect(res.body.firstName).toBe(createUserDto.firstName);
          expect(res.body.lastName).toBe(createUserDto.lastName);
        });
    });

    it('should return 400 if validation fails', () => {
      // Act & Assert
      return request(app.getHttpServer())
        .post('/users')
        .send({
          // Missing required fields
          email: 'invalid-email',
        })
        .expect(400);
    });

    it('should return 409 if email already exists', () => {
      // Arrange
      const createUserDto = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Existing',
        lastName: 'User',
      };

      prismaMock.user.findUnique.mockResolvedValue(mockUser); // User already exists

      // Act & Assert
      return request(app.getHttpServer())
        .post('/users')
        .send(createUserDto)
        .expect(409);
    });
  });

  describe('/users/:id (PUT)', () => {
    it('should update a user', () => {
      // Arrange
      const updateData = { firstName: 'Updated', lastName: 'Name' };
      const updatedUser = { ...mockUser, ...updateData };

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(updatedUser);

      // Act & Assert
      return request(app.getHttpServer())
        .put(`/users/${mockUser.id}`)
        .send(updateData)
        .expect(200)
        .expect(res => {
          expect(res.body.firstName).toBe(updateData.firstName);
          expect(res.body.lastName).toBe(updateData.lastName);
        });
    });

    it('should return 404 if user not found', () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      return request(app.getHttpServer())
        .put('/users/non-existent-id')
        .send({ firstName: 'Updated' })
        .expect(404);
    });
  });

  describe('/users/:id (DELETE)', () => {
    it('should delete a user', () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.delete.mockResolvedValue(mockUser);

      // Act & Assert
      return request(app.getHttpServer())
        .delete(`/users/${mockUser.id}`)
        .expect(204);
    });

    it('should return 404 if user not found', () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      return request(app.getHttpServer())
        .delete('/users/non-existent-id')
        .expect(404);
    });
  });
});