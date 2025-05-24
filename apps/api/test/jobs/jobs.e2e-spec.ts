import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { DayOfWeek, UserRole } from '@prisma/client';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue(true),
}));

describe('JobsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let testCategoryId: string;
  let testShiftId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);

    await app.init();

    // Create test data
    // Create a test shift needed for jobs
    const shift = await prisma.shift.create({
      data: {
        name: 'Test Shift',
        description: 'Test Shift Description',
        startTime: '09:00',
        endTime: '17:00',
        dayOfWeek: DayOfWeek.MONDAY,
      }
    });
    testShiftId = shift.id;
    
    // Create a test job category
    const category = await prisma.jobCategory.create({
      data: {
        name: 'Test Category',
        description: 'Test Category Description',
        location: 'Test Location',
      },
    });
    testCategoryId = category.id;

    // Ensure test users exist
    let admin = await prisma.user.findUnique({
      where: { email: 'admin@example.playaplan.app' },
    });

    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: 'admin@example.playaplan.app',
          password: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', // 'admin123'
          firstName: 'Admin',
          lastName: 'User',
          role: UserRole.ADMIN,
          isEmailVerified: true,
        },
      });
    }

    let user = await prisma.user.findUnique({
      where: { email: 'user@example.playaplan.app' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'user@example.playaplan.app',
          password: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', // 'user123'
          firstName: 'Regular',
          lastName: 'User',
          role: UserRole.PARTICIPANT,
          isEmailVerified: true,
        },
      });
    }

    // Get auth tokens
    const adminResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@example.playaplan.app',
        password: 'admin123',
      });

    adminToken = adminResponse.body.accessToken;

    const userResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'user@example.playaplan.app',
        password: 'user123',
      });

    userToken = userResponse.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup: delete test data
    await prisma.job.deleteMany({
      where: { categoryId: testCategoryId },
    }).catch(() => {
      // Ignore errors if already deleted
    });
    
    await prisma.jobCategory.delete({
      where: { id: testCategoryId },
    }).catch(() => {
      // Ignore errors if already deleted
    });
    
    await prisma.shift.delete({
      where: { id: testShiftId },
    }).catch(() => {
      // Ignore errors if already deleted
    });
    
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /jobs', () => {
    it('should create a job (admin)', async () => {
      const createJobDto = {
        name: 'Test Job',
        location: 'Test Location',
        categoryId: testCategoryId,
        shiftId: testShiftId,
        maxRegistrations: 10,
      };

      const response = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createJobDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createJobDto.name);
      expect(response.body.location).toBe(createJobDto.location);
      expect(response.body.shiftId).toBe(testShiftId);
      expect(response.body.maxRegistrations).toBe(createJobDto.maxRegistrations);
    });

    it('should not create a job (non-admin)', async () => {
      const createJobDto = {
        name: 'Test Job',
        location: 'Test Location',
        categoryId: testCategoryId,
        shiftId: testShiftId,
        maxRegistrations: 10,
      };

      await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(createJobDto)
        .expect(403);
    });
  });

  describe('GET /jobs', () => {
    it('should return all jobs', async () => {
      const response = await request(app.getHttpServer())
        .get('/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /jobs/:id', () => {
    let jobId: string;

    beforeAll(async () => {
      // Create a job to test with
      const job = await prisma.job.create({
        data: {
          name: 'Test Job for GET',
          location: 'Test Location',
          categoryId: testCategoryId,
          shiftId: testShiftId,
          maxRegistrations: 10,
        },
      });
      jobId = job.id;
    });

    it('should return a job by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(jobId);
      expect(response.body.name).toBe('Test Job for GET');
      expect(response.body.maxRegistrations).toBe(10);
    });

    it('should return 404 for non-existent job', async () => {
      await request(app.getHttpServer())
        .get('/jobs/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('PATCH /jobs/:id', () => {
    let jobId: string;

    beforeAll(async () => {
      // Create a job to test with
      const job = await prisma.job.create({
        data: {
          name: 'Test Job for PATCH',
          location: 'Test Location',
          categoryId: testCategoryId,
          shiftId: testShiftId,
          maxRegistrations: 10,
        },
      });
      jobId = job.id;
    });

    it('should update a job (admin)', async () => {
      const updateJobDto = {
        name: 'Updated Job',
        location: 'Updated Location',
        maxRegistrations: 15,
      };

      const response = await request(app.getHttpServer())
        .patch(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateJobDto)
        .expect(200);

      expect(response.body.id).toBe(jobId);
      expect(response.body.name).toBe(updateJobDto.name);
      expect(response.body.location).toBe(updateJobDto.location);
      expect(response.body.maxRegistrations).toBe(updateJobDto.maxRegistrations);
    });

    it('should not update a job (non-admin)', async () => {
      const updateJobDto = {
        name: 'Updated Job',
        maxRegistrations: 20,
      };

      await request(app.getHttpServer())
        .patch(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateJobDto)
        .expect(403);
    });
  });

  describe('DELETE /jobs/:id', () => {
    let jobId: string;

    beforeAll(async () => {
      // Create a job to test with
      const job = await prisma.job.create({
        data: {
          name: 'Test Job for DELETE',
          location: 'Test Location',
          categoryId: testCategoryId,
          shiftId: testShiftId,
          maxRegistrations: 10,
        },
      });
      jobId = job.id;
    });

    it('should delete a job (admin)', async () => {
      await request(app.getHttpServer())
        .delete(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should not delete a job (non-admin)', async () => {
      // Create a new job for this test
      const job = await prisma.job.create({
        data: {
          name: 'Test Job for DELETE (non-admin)',
          location: 'Test Location',
          categoryId: testCategoryId,
          shiftId: testShiftId,
          maxRegistrations: 10,
        },
      });

      await request(app.getHttpServer())
        .delete(`/jobs/${job.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
}); 