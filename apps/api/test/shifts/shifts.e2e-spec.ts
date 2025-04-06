import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('ShiftsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let campId: string;
  let jobId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);

    await app.init();

    // Create test admin user and get token
    const adminResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123',
      });

    adminToken = adminResponse.body.accessToken;

    // Create test regular user and get token
    const userResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'user123',
      });

    userToken = userResponse.body.accessToken;

    // Create a test camp
    const createCampResponse = await request(app.getHttpServer())
      .post('/camps')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Camp',
        description: 'Test Camp Description',
        startDate: '2023-06-01T00:00:00.000Z',
        endDate: '2023-06-07T00:00:00.000Z',
        location: 'Test Location',
        capacity: 100,
        isActive: true,
      });

    campId = createCampResponse.body.id;

    // Create a test job category first
    const createCategoryResponse = await request(app.getHttpServer())
      .post('/jobs/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Category',
        description: 'Test Category Description',
      });

    const categoryId = createCategoryResponse.body.id;

    // Create a test job
    const createJobResponse = await request(app.getHttpServer())
      .post('/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Job',
        description: 'Test Job Description',
        location: 'Test Job Location',
        categoryId: categoryId,
      });

    jobId = createJobResponse.body.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /shifts', () => {
    it('should create a shift (admin)', async () => {
      const createShiftDto = {
        startTime: '2023-06-01T09:00:00.000Z',
        endTime: '2023-06-01T17:00:00.000Z',
        maxRegistrations: 10,
        campId: campId,
        jobId: jobId,
      };

      const response = await request(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(new Date(response.body.startTime).toISOString()).toBe(
        createShiftDto.startTime,
      );
      expect(new Date(response.body.endTime).toISOString()).toBe(
        createShiftDto.endTime,
      );
      expect(response.body.maxRegistrations).toBe(createShiftDto.maxRegistrations);
      expect(response.body.campId).toBe(createShiftDto.campId);
      expect(response.body.jobId).toBe(createShiftDto.jobId);
    });

    it('should not create a shift (non-admin)', async () => {
      const createShiftDto = {
        startTime: '2023-06-01T09:00:00.000Z',
        endTime: '2023-06-01T17:00:00.000Z',
        maxRegistrations: 10,
        campId: campId,
        jobId: jobId,
      };

      await request(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${userToken}`)
        .send(createShiftDto)
        .expect(403);
    });
  });

  describe('GET /shifts', () => {
    it('should return all shifts', async () => {
      const response = await request(app.getHttpServer())
        .get('/shifts')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /shifts/:id', () => {
    it('should return a shift by id', async () => {
      // First create a shift
      const createShiftDto = {
        startTime: '2023-06-02T09:00:00.000Z',
        endTime: '2023-06-02T17:00:00.000Z',
        maxRegistrations: 15,
        campId: campId,
        jobId: jobId,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto);

      const shiftId = createResponse.body.id;

      // Then get it
      const response = await request(app.getHttpServer())
        .get(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(shiftId);
      expect(new Date(response.body.startTime).toISOString()).toBe(
        createShiftDto.startTime,
      );
      expect(response.body.maxRegistrations).toBe(createShiftDto.maxRegistrations);
    });

    it('should return 404 for non-existent shift', async () => {
      await request(app.getHttpServer())
        .get('/shifts/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('PATCH /shifts/:id', () => {
    it('should update a shift (admin)', async () => {
      // First create a shift
      const createShiftDto = {
        startTime: '2023-06-03T09:00:00.000Z',
        endTime: '2023-06-03T17:00:00.000Z',
        maxRegistrations: 20,
        campId: campId,
        jobId: jobId,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto);

      const shiftId = createResponse.body.id;

      // Then update it
      const updateShiftDto = {
        startTime: '2023-06-03T10:00:00.000Z',
        endTime: '2023-06-03T18:00:00.000Z',
        maxRegistrations: 25,
      };

      const response = await request(app.getHttpServer())
        .patch(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateShiftDto)
        .expect(200);

      expect(response.body.id).toBe(shiftId);
      expect(new Date(response.body.startTime).toISOString()).toBe(
        updateShiftDto.startTime,
      );
      expect(new Date(response.body.endTime).toISOString()).toBe(
        updateShiftDto.endTime,
      );
      expect(response.body.maxRegistrations).toBe(updateShiftDto.maxRegistrations);
    });

    it('should not update a shift (non-admin)', async () => {
      // First create a shift
      const createShiftDto = {
        startTime: '2023-06-04T09:00:00.000Z',
        endTime: '2023-06-04T17:00:00.000Z',
        maxRegistrations: 30,
        campId: campId,
        jobId: jobId,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto);

      const shiftId = createResponse.body.id;

      // Then try to update it as non-admin
      const updateShiftDto = {
        maxRegistrations: 35,
      };

      await request(app.getHttpServer())
        .patch(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateShiftDto)
        .expect(403);
    });
  });

  describe('DELETE /shifts/:id', () => {
    it('should delete a shift (admin)', async () => {
      // First create a shift
      const createShiftDto = {
        startTime: '2023-06-05T09:00:00.000Z',
        endTime: '2023-06-05T17:00:00.000Z',
        maxRegistrations: 40,
        campId: campId,
        jobId: jobId,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto);

      const shiftId = createResponse.body.id;

      // Then delete it
      await request(app.getHttpServer())
        .delete(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should not delete a shift (non-admin)', async () => {
      // First create a shift
      const createShiftDto = {
        startTime: '2023-06-06T09:00:00.000Z',
        endTime: '2023-06-06T17:00:00.000Z',
        maxRegistrations: 50,
        campId: campId,
        jobId: jobId,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto);

      const shiftId = createResponse.body.id;

      // Then try to delete it as non-admin
      await request(app.getHttpServer())
        .delete(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
}); 