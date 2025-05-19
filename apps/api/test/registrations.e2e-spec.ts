import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RegistrationStatus, UserRole, DayOfWeek } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('RegistrationsController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  // Test data
  let adminToken: string;
  let userToken: string;
  let testUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isEmailVerified: boolean;
  };
  let testAdmin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isEmailVerified: boolean;
  };
  let testCamp: {
    id: string;
    name: string;
    description: string | null;
    startDate: Date;
    endDate: Date;
    location: string;
    capacity: number;
    isActive: boolean;
  };
  let testShift: {
    id: string;
    name: string;
    description: string | null;
    startTime: string;
    endTime: string;
    campId: string;
    dayOfWeek: DayOfWeek;
  };
  let testCategory: {
    id: string;
    name: string;
    description: string | null;
  };
  let testJob: {
    id: string;
    name: string;
    description: string | null;
    location: string;
    categoryId: string;
    shiftId: string;
    maxRegistrations: number;
  };
  let testRegistration: {
    id: string;
    status: RegistrationStatus;
    userId: string;
    jobId: string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    
    await app.init();

    // Clean up database before tests
    await cleanDatabase();
    
    // Create test data
    await createTestData();
    
    // Generate tokens
    adminToken = jwtService.sign({ 
      sub: testAdmin.id,
      email: testAdmin.email,
      role: testAdmin.role
    });
    
    userToken = jwtService.sign({ 
      sub: testUser.id,
      email: testUser.email,
      role: testUser.role
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  async function cleanDatabase() {
    // Delete in correct order to respect foreign key constraints
    try {
      // First, clear any registrations
      await prismaService.registration.deleteMany();
      
      // Then clear any payments (they have a relation to users)
      await prismaService.payment.deleteMany();
      
      // Now clear jobs, shifts, and related entities
      await prismaService.job.deleteMany();
      await prismaService.shift.deleteMany();
      await prismaService.jobCategory.deleteMany();
      await prismaService.camp.deleteMany();
      
      // Finally, clear users
      await prismaService.user.deleteMany();
    } catch (error) {
      console.error('Error cleaning database:', error);
      // Continue with tests even if cleanup fails
    }
  }

  async function createTestData() {
    // Create test users
    testAdmin = await prismaService.user.create({
      data: {
        email: 'admin@test.com',
        password: 'hashed_password',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        isEmailVerified: true,
      },
    });

    testUser = await prismaService.user.create({
      data: {
        email: 'user@test.com',
        password: 'hashed_password',
        firstName: 'Regular',
        lastName: 'User',
        role: UserRole.PARTICIPANT,
        isEmailVerified: true,
      },
    });

    // Create test camp
    testCamp = await prismaService.camp.create({
      data: {
        name: 'Test Camp',
        description: 'Test Camp Description',
        startDate: new Date('2023-06-01'),
        endDate: new Date('2023-06-10'),
        location: 'Test Location',
        capacity: 100,
        isActive: true,
      },
    });

    // Create test shift
    testShift = await prismaService.shift.create({
      data: {
        name: 'Test Shift',
        description: 'Test Shift Description',
        startTime: '09:00',
        endTime: '17:00',
        dayOfWeek: DayOfWeek.MONDAY,
        campId: testCamp.id,
      },
    });

    // Create test job category
    testCategory = await prismaService.jobCategory.create({
      data: {
        name: 'Test Category',
        description: 'Test Category Description',
      },
    });

    // Create test job
    testJob = await prismaService.job.create({
      data: {
        name: 'Test Job',
        description: 'Test Job Description',
        location: 'Test Job Location',
        categoryId: testCategory.id,
        shiftId: testShift.id,
        maxRegistrations: 10,
      },
    });

    // Create test registration
    testRegistration = await prismaService.registration.create({
      data: {
        status: RegistrationStatus.PENDING,
        userId: testUser.id,
        jobId: testJob.id,
      },
    });
  }

  describe('/registrations (GET)', () => {
    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .get('/registrations')
        .expect(401);
    });

    it('should return all registrations for admin', () => {
      return request(app.getHttpServer())
        .get('/registrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('userId');
          expect(res.body[0]).toHaveProperty('jobId');
        });
    });

    it('should filter registrations by userId', () => {
      return request(app.getHttpServer())
        .get(`/registrations?userId=${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].userId).toBe(testUser.id);
        });
    });

    it('should filter registrations by jobId', () => {
      return request(app.getHttpServer())
        .get(`/registrations?jobId=${testJob.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].jobId).toBe(testJob.id);
        });
    });
  });

  describe('/registrations/:id (GET)', () => {
    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .get(`/registrations/${testRegistration.id}`)
        .expect(401);
    });

    it('should return a registration by id for admin', () => {
      return request(app.getHttpServer())
        .get(`/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toHaveProperty('id', testRegistration.id);
          expect(res.body).toHaveProperty('userId', testUser.id);
          expect(res.body).toHaveProperty('jobId', testJob.id);
        });
    });

    it('should return 404 for non-existent registration', () => {
      return request(app.getHttpServer())
        .get('/registrations/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('/registrations (POST)', () => {
    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .post('/registrations')
        .send({
          userId: testUser.id,
          jobId: testJob.id,
        })
        .expect(401);
    });

    it('should create a new registration for admin', async () => {
      // First delete existing registration to avoid conflict
      await prismaService.registration.delete({
        where: { id: testRegistration.id },
      });

      return request(app.getHttpServer())
        .post('/registrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          jobId: testJob.id,
        })
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('userId', testUser.id);
          expect(res.body).toHaveProperty('jobId', testJob.id);
          expect(res.body).toHaveProperty('status');
          // Save the new registration ID for future tests
          testRegistration = res.body;
        });
    });

    it('should return 400 for invalid data', () => {
      return request(app.getHttpServer())
        .post('/registrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing required fields
        })
        .expect(400);
    });
  });

  describe('/registrations/:id (PATCH)', () => {
    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .patch(`/registrations/${testRegistration.id}`)
        .send({
          status: RegistrationStatus.CONFIRMED,
        })
        .expect(401);
    });

    it('should update a registration for admin', () => {
      return request(app.getHttpServer())
        .patch(`/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: RegistrationStatus.CONFIRMED,
        })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toHaveProperty('id', testRegistration.id);
          expect(res.body).toHaveProperty('status', RegistrationStatus.CONFIRMED);
        });
    });

    it('should return 404 for non-existent registration', () => {
      return request(app.getHttpServer())
        .patch('/registrations/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: RegistrationStatus.CONFIRMED,
        })
        .expect(404);
    });
  });

  describe('/registrations/:id (DELETE)', () => {
    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .delete(`/registrations/${testRegistration.id}`)
        .expect(401);
    });

    it('should return 403 for non-admin users', () => {
      return request(app.getHttpServer())
        .delete(`/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should delete a registration for admin', () => {
      return request(app.getHttpServer())
        .delete(`/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toHaveProperty('id', testRegistration.id);
        });
    });

    it('should return 404 for non-existent registration', () => {
      return request(app.getHttpServer())
        .delete('/registrations/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('/registrations/test/admin (GET)', () => {
    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .get('/registrations/test/admin')
        .expect(401);
    });

    it('should return 403 for non-admin users', () => {
      return request(app.getHttpServer())
        .get('/registrations/test/admin')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return a test message for admin', () => {
      return request(app.getHttpServer())
        .get('/registrations/test/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toHaveProperty('message', 'Admin access to registrations module confirmed');
        });
    });
  });
});
