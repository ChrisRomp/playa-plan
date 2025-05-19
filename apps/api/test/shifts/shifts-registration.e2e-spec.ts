import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { DayOfWeek } from '../../src/common/enums/day-of-week.enum';
import { JwtService } from '@nestjs/jwt';
import { Camp, Job, JobCategory, Prisma, RegistrationStatus, Shift, User, UserRole } from '@prisma/client';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue(true),
}));

describe('Job Registrations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;
  
  // Test data
  let testAdmin: User;
  let testUser: User;
  let testCamp: Camp;
  let testJobCategory: JobCategory;
  let testShift: Shift;
  let testJob: Job;
  let registrationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    await app.init();
    
    // Clean up database
    await cleanupDatabase();
    
    // Create test data
    await createTestData();
    
    // Generate JWT tokens
    adminToken = jwtService.sign({ 
      sub: testAdmin.id,
      email: testAdmin.email,
      role: testAdmin.role,
      roles: [UserRole.ADMIN] // Include roles array for authorization checks
    });
    
    userToken = jwtService.sign({ 
      sub: testUser.id,
      email: testUser.email,
      role: testUser.role,
      roles: [UserRole.PARTICIPANT] // Include roles array for authorization checks
    });
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
    await app.close();
  });
  
  async function cleanupDatabase() {
    try {
      // Delete in correct order to respect foreign key constraints
      await prisma.registration.deleteMany({});
      await prisma.job.deleteMany({});
      await prisma.shift.deleteMany({});
      await prisma.jobCategory.deleteMany({});
      
      // Delete camping options that might reference camps
      await prisma.campingOptionFieldValue.deleteMany({});
      await prisma.campingOptionField.deleteMany({});
      await prisma.campingOptionRegistration.deleteMany({});
      await prisma.campingOption.deleteMany({});
      
      await prisma.camp.deleteMany({});
      
      // Delete test users
      await prisma.user.deleteMany({
        where: {
          email: {
            in: ['registration-test-admin@example.playaplan.app', 'registration-test-user@example.playaplan.app', 'another-registration-test-user@example.playaplan.app']
          }
        }
      });
    } catch (error) {
      console.error('Error cleaning database:', error);
    }
  }
  
  async function createTestData() {
    // Create test users
    testAdmin = await prisma.user.create({
      data: {
        email: 'registration-test-admin@example.playaplan.app',
        password: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', // 'admin123'
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        isEmailVerified: true,
      },
    });

    testUser = await prisma.user.create({
      data: {
        email: 'registration-test-user@example.playaplan.app',
        password: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', // 'user123'
        firstName: 'Regular',
        lastName: 'User',
        role: UserRole.PARTICIPANT,
        isEmailVerified: true,
      },
    });
    
    // Create a test camp
    testCamp = await prisma.camp.create({
      data: {
        name: 'Test Camp for Registration',
        description: 'Test Camp Description',
        startDate: new Date('2023-06-01'),
        endDate: new Date('2023-06-07'),
        location: 'Test Location',
        capacity: 100,
        isActive: true,
      }
    });

    // Create a test job category
    testJobCategory = await prisma.jobCategory.create({
      data: {
        name: 'Test Registration Category',
        description: 'Test Category Description',
      }
    });

    // Create a test shift (now the job references the shift, not the other way around)
    testShift = await prisma.shift.create({
      data: {
        name: "Test Registration Shift",
        description: "Test Shift Description",
        startTime: '09:00',
        endTime: '17:00',
        dayOfWeek: DayOfWeek.MONDAY,
        campId: testCamp.id,
      }
    });
    
    // Create a test job
    testJob = await prisma.job.create({
      data: {
        name: 'Test Registration Job',
        description: 'Test Job Description',
        location: 'Test Job Location',
        categoryId: testJobCategory.id,
        shiftId: testShift.id,
        maxRegistrations: 10,
      }
    });
  }

  describe('POST /jobs/:id/register', () => {
    it('should register a user for a job', async () => {
      const response = await supertest(app.getHttpServer())
        .post(`/jobs/${testJob.id}/register`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.jobId).toBe(testJob.id);
      expect(response.body.status).toBe('PENDING');
      
      // Store registration ID for later tests
      registrationId = response.body.id;
    });

    it('should not allow registering for the same job twice', async () => {
      await supertest(app.getHttpServer())
        .post(`/jobs/${testJob.id}/register`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
    });

    it('should not allow registering for a non-existent job', async () => {
      await supertest(app.getHttpServer())
        .post(`/jobs/non-existent-id/register`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('GET /jobs/registrations/me', () => {
    it('should get all job registrations for the current user', async () => {
      const response = await supertest(app.getHttpServer())
        .get('/jobs/registrations/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].id).toBe(registrationId);
      expect(response.body[0].jobId).toBe(testJob.id);
    });
  });

  describe('GET /jobs/registrations/:id', () => {
    it('should get a specific registration by ID', async () => {
      const response = await supertest(app.getHttpServer())
        .get(`/jobs/registrations/${registrationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(registrationId);
      expect(response.body.jobId).toBe(testJob.id);
    });

    it('should not allow accessing another user\'s registration details', async () => {
      // Create another user
      const anotherUser = await prisma.user.create({
        data: {
          email: 'another-registration-test-user@example.playaplan.app',
          password: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', // 'user123'
          firstName: 'Another',
          lastName: 'User',
          role: UserRole.PARTICIPANT,
          isEmailVerified: true,
        },
      });
      
      const anotherUserToken = jwtService.sign({ 
        sub: anotherUser.id,
        email: anotherUser.email,
        role: anotherUser.role,
        roles: [UserRole.PARTICIPANT] // Include roles array for authorization checks
      });

      await supertest(app.getHttpServer())
        .get(`/jobs/registrations/${registrationId}`)
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent registration', async () => {
      await supertest(app.getHttpServer())
        .get('/jobs/registrations/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('DELETE /jobs/registrations/:id', () => {
    it('should cancel a job registration', async () => {
      await supertest(app.getHttpServer())
        .delete(`/jobs/registrations/${registrationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify it's been cancelled
      const response = await supertest(app.getHttpServer())
        .get(`/jobs/registrations/${registrationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.body.status).toBe('CANCELLED');
    });

    it('should not allow cancelling a non-existent registration', async () => {
      await supertest(app.getHttpServer())
        .delete('/jobs/registrations/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('GET /jobs/:id/registrations (admin only)', () => {
    it('should get all registrations for a specific job (admin)', async () => {
      const response = await supertest(app.getHttpServer())
        .get(`/jobs/${testJob.id}/registrations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Even if cancelled, the registration should still show up
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].jobId).toBe(testJob.id);
    });

    it('should not allow non-admin users to view all registrations for a job', async () => {
      await supertest(app.getHttpServer())
        .get(`/jobs/${testJob.id}/registrations`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
}); 