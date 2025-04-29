import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prismaMock: any;
  let jwtService: JwtService;

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

  const mockAdmin = {
    ...mockUser,
    id: 'admin-uuid-e2e',
    email: 'admin-e2e@example.com',
    role: UserRole.ADMIN,
  };

  const mockStaff = {
    ...mockUser,
    id: 'staff-uuid-e2e',
    email: 'staff-e2e@example.com',
    role: UserRole.STAFF,
  };

  // Helper to create authentication tokens for testing
  const getAuthToken = (user: any) => {
    return jwtService.sign({ sub: user.id, email: user.email, role: user.role });
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
    jwtService = moduleFixture.get<JwtService>(JwtService);
    
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

  describe('Authorization Tests', () => {
    describe('Role-based access', () => {
      it('should allow admins to access all users', () => {
        // Arrange
        const adminToken = getAuthToken(mockAdmin);
        prismaMock.user.findMany.mockResolvedValue([mockUser, mockAdmin]);

        // Act & Assert
        return request(app.getHttpServer())
          .get('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect((res: request.Response) => {
            expect(Array.isArray(res.body)).toBeTruthy();
            expect(res.body.length).toBe(2);
          });
      });

      it('should allow staff to access all users', () => {
        // Arrange
        const staffToken = getAuthToken(mockStaff);
        prismaMock.user.findMany.mockResolvedValue([mockUser, mockStaff]);

        // Act & Assert
        return request(app.getHttpServer())
          .get('/users')
          .set('Authorization', `Bearer ${staffToken}`)
          .expect((res: request.Response) => {
            expect(Array.isArray(res.body)).toBeTruthy();
          });
      });

      it('should deny participants access to all users list', () => {
        // Arrange
        const userToken = getAuthToken(mockUser);

        // Act & Assert
        return request(app.getHttpServer())
          .get('/users')
          .set('Authorization', `Bearer ${userToken}`)
          .expect((res: request.Response) => {
            expect(res.status).toBe(403); // Forbidden
          });
      });

      it('should deny access to users without authentication', () => {
        // Act & Assert
        return request(app.getHttpServer())
          .get('/users')
          .expect((res: request.Response) => {
            expect(res.status).toBe(401); // Unauthorized
          });
      });
    });

    describe('Self or Admin access', () => {
      it('should allow users to access their own profile', () => {
        // Arrange
        const userToken = getAuthToken(mockUser);
        prismaMock.user.findUnique.mockResolvedValue(mockUser);

        // Act & Assert
        return request(app.getHttpServer())
          .get(`/users/${mockUser.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect((res: request.Response) => {
            expect(res.body.id).toBe(mockUser.id);
          });
      });

      it('should deny users access to other profiles', () => {
        // Arrange
        const userToken = getAuthToken(mockUser);
        prismaMock.user.findUnique.mockResolvedValue(mockAdmin); // Different user

        // Act & Assert
        return request(app.getHttpServer())
          .get(`/users/${mockAdmin.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect((res: request.Response) => {
            expect(res.status).toBe(403); // Forbidden
          });
      });

      it('should allow admins to access any profile', () => {
        // Arrange
        const adminToken = getAuthToken(mockAdmin);
        prismaMock.user.findUnique.mockResolvedValue(mockUser);

        // Act & Assert
        return request(app.getHttpServer())
          .get(`/users/${mockUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect((res: request.Response) => {
            expect(res.status).toBe(200);
          });
      });

      it('should allow staff to access participant profiles', () => {
        // Arrange
        const staffToken = getAuthToken(mockStaff);
        prismaMock.user.findUnique.mockResolvedValue(mockUser);

        // Act & Assert
        return request(app.getHttpServer())
          .get(`/users/${mockUser.id}`)
          .set('Authorization', `Bearer ${staffToken}`)
          .expect((res: request.Response) => {
            expect(res.status).toBe(200);
          });
      });

      it('should deny staff access to admin profiles', () => {
        // Arrange
        const staffToken = getAuthToken(mockStaff);
        const mockUserWithResult = {
          ...mockUser,
          role: UserRole.ADMIN
        };
        
        prismaMock.user.findUnique.mockImplementation(async (args: Prisma.UserFindUniqueArgs) => {
          if (args.where?.id === mockAdmin.id) {
            return mockAdmin;
          }
          return null;
        });

        // Act & Assert
        return request(app.getHttpServer())
          .get(`/users/${mockAdmin.id}`)
          .set('Authorization', `Bearer ${staffToken}`)
          .expect((res: request.Response) => {
            expect(res.status).toBe(403); // Forbidden
          });
      });
    });

    describe('/users/me/profile (GET)', () => {
      it('should return the current user profile', () => {
        // Arrange
        const userToken = getAuthToken(mockUser);
        prismaMock.user.findUnique.mockResolvedValue(mockUser);

        // Act & Assert
        return request(app.getHttpServer())
          .get('/users/me/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .expect((res: request.Response) => {
            expect(res.body.id).toBe(mockUser.id);
            expect(res.body.email).toBe(mockUser.email);
          });
      });

      it('should require authentication', () => {
        // Act & Assert
        return request(app.getHttpServer())
          .get('/users/me/profile')
          .expect((res: request.Response) => {
            expect(res.status).toBe(401); // Unauthorized
          });
      });
    });

    describe('Role update restrictions', () => {
      it('should allow admins to update user roles', () => {
        // Arrange
        const adminToken = getAuthToken(mockAdmin);
        const updateData = { role: UserRole.STAFF };
        
        const updatedUser = { 
          ...mockUser,
          role: UserRole.STAFF
        };

        prismaMock.user.findUnique.mockResolvedValue(mockUser);
        prismaMock.user.update.mockResolvedValue(updatedUser);

        // Act & Assert
        return request(app.getHttpServer())
          .put(`/users/${mockUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect((res: request.Response) => {
            expect(res.body.role).toBe(UserRole.STAFF);
          });
      });

      it('should deny regular users from updating roles', () => {
        // Arrange
        const userToken = getAuthToken(mockUser);
        const updateData = { role: UserRole.ADMIN }; // Trying to become admin
        
        prismaMock.user.findUnique.mockResolvedValue(mockUser);

        // Act & Assert
        return request(app.getHttpServer())
          .put(`/users/${mockUser.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(updateData)
          .expect((res: request.Response) => {
            expect(res.status).toBe(403); // Forbidden
          });
      });
    });

    describe('/users/admin/test (GET)', () => {
      it('should allow access to admins', () => {
        // Arrange
        const adminToken = getAuthToken(mockAdmin);

        // Act & Assert
        return request(app.getHttpServer())
          .get('/users/admin/test')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect((res: request.Response) => {
            expect(res.body.message).toBe('Admin test successful');
          });
      });

      it('should deny access to non-admins', () => {
        // Arrange
        const userToken = getAuthToken(mockUser);

        // Act & Assert
        return request(app.getHttpServer())
          .get('/users/admin/test')
          .set('Authorization', `Bearer ${userToken}`)
          .expect((res: request.Response) => {
            expect(res.status).toBe(403); // Forbidden
          });
      });
    });
  });

  describe('/users (GET)', () => {
    it('should return an array of users', () => {
      // Arrange
      const adminToken = getAuthToken(mockAdmin);
      prismaMock.user.findMany.mockResolvedValue([mockUser]);

      // Act & Assert
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res: request.Response) => {
          expect(Array.isArray(res.body)).toBeTruthy();
          expect(res.body.length).toBe(1);
          expect(res.body[0].email).toBe(mockUser.email);
        });
    });
  });

  describe('/users/:id (GET)', () => {
    it('should return a user by ID', () => {
      // Arrange
      const adminToken = getAuthToken(mockAdmin);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      return request(app.getHttpServer())
        .get(`/users/${mockUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res: request.Response) => {
          expect(res.body.id).toBe(mockUser.id);
          expect(res.body.email).toBe(mockUser.email);
        });
    });

    it('should return 404 if user not found', () => {
      // Arrange
      const adminToken = getAuthToken(mockAdmin);
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      return request(app.getHttpServer())
        .get('/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res: request.Response) => {
          expect(res.status).toBe(404);
        });
    });
  });

  describe('/users (POST)', () => {
    it('should create a new user', () => {
      // Arrange
      const adminToken = getAuthToken(mockAdmin);
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
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createUserDto)
        .expect((res: request.Response) => {
          expect(res.status).toBe(201);
          expect(res.body.email).toBe(createUserDto.email);
          expect(res.body.firstName).toBe(createUserDto.firstName);
          expect(res.body.lastName).toBe(createUserDto.lastName);
        });
    });

    it('should return 400 if validation fails', () => {
      // Arrange
      const adminToken = getAuthToken(mockAdmin);
      
      // Act & Assert
      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing required fields
          email: 'invalid-email',
        })
        .expect((res: request.Response) => {
          expect(res.status).toBe(400);
        });
    });

    it('should return 409 if email already exists', () => {
      // Arrange
      const adminToken = getAuthToken(mockAdmin);
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
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createUserDto)
        .expect((res: request.Response) => {
          expect(res.status).toBe(409);
        });
    });
  });

  describe('/users/:id (PUT)', () => {
    it('should update a user', () => {
      // Arrange
      const adminToken = getAuthToken(mockAdmin);
      const updateData = { firstName: 'Updated', lastName: 'Name' };
      const updatedUser = { ...mockUser, ...updateData };

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(updatedUser);

      // Act & Assert
      return request(app.getHttpServer())
        .put(`/users/${mockUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect((res: request.Response) => {
          expect(res.body.firstName).toBe(updateData.firstName);
          expect(res.body.lastName).toBe(updateData.lastName);
        });
    });

    it('should return 404 if user not found', () => {
      // Arrange
      const adminToken = getAuthToken(mockAdmin);
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      return request(app.getHttpServer())
        .put('/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Updated' })
        .expect((res: request.Response) => {
          expect(res.status).toBe(404);
        });
    });
  });

  describe('/users/:id (DELETE)', () => {
    it('should delete a user', () => {
      // Arrange
      const adminToken = getAuthToken(mockAdmin);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.delete.mockResolvedValue(mockUser);

      // Act & Assert
      return request(app.getHttpServer())
        .delete(`/users/${mockUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res: request.Response) => {
          expect(res.status).toBe(204);
        });
    });

    it('should return 404 if user not found', () => {
      // Arrange
      const adminToken = getAuthToken(mockAdmin);
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      return request(app.getHttpServer())
        .delete('/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res: request.Response) => {
          expect(res.status).toBe(404);
        });
    });
  });
});