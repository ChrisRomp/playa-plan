import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { DayOfWeek } from '../../src/common/enums/day-of-week.enum';

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
    const adminResponse = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123',
      });

    adminToken = adminResponse.body.accessToken;

    // Create test regular user and get token
    const userResponse = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'user123',
      });

    userToken = userResponse.body.accessToken;

    // Create a test camp
    const createCampResponse = await supertest(app.getHttpServer())
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
    const createCategoryResponse = await supertest(app.getHttpServer())
      .post('/jobs/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Category',
        description: 'Test Category Description',
      });

    const categoryId = createCategoryResponse.body.id;

    // Create a test job
    const createJobResponse = await supertest(app.getHttpServer())
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
        name: 'Test Shift',
        description: 'Test Shift Description',
        startTime: '2023-06-01T09:00:00.000Z',
        endTime: '2023-06-01T17:00:00.000Z',
        dayOfWeek: DayOfWeek.MONDAY,
        campId: campId,
      };

      const response = await supertest(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createShiftDto.name);
      expect(response.body.description).toBe(createShiftDto.description);
      expect(new Date(response.body.startTime).toISOString()).toBe(
        createShiftDto.startTime,
      );
      expect(new Date(response.body.endTime).toISOString()).toBe(
        createShiftDto.endTime,
      );
      expect(response.body.dayOfWeek).toBe(createShiftDto.dayOfWeek);
      expect(response.body.campId).toBe(createShiftDto.campId);
    });

    it('should not create a shift (non-admin)', async () => {
      const createShiftDto = {
        name: 'Test Shift',
        description: 'Test Shift Description',
        startTime: '2023-06-01T09:00:00.000Z',
        endTime: '2023-06-01T17:00:00.000Z',
        dayOfWeek: DayOfWeek.MONDAY,
        campId: campId,
      };

      await supertest(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${userToken}`)
        .send(createShiftDto)
        .expect(403);
    });
  });

  describe('GET /shifts', () => {
    it('should return all shifts', async () => {
      const response = await supertest(app.getHttpServer())
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
        name: 'Test Shift for GET',
        description: 'Test Shift Description',
        startTime: '2023-06-02T09:00:00.000Z',
        endTime: '2023-06-02T17:00:00.000Z',
        dayOfWeek: DayOfWeek.TUESDAY,
        campId: campId,
      };

      const createResponse = await supertest(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto);

      const shiftId = createResponse.body.id;

      // Then get it
      const response = await supertest(app.getHttpServer())
        .get(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(shiftId);
      expect(response.body.name).toBe(createShiftDto.name);
      expect(new Date(response.body.startTime).toISOString()).toBe(
        createShiftDto.startTime,
      );
    });

    it('should return 404 for non-existent shift', async () => {
      await supertest(app.getHttpServer())
        .get('/shifts/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('PATCH /shifts/:id', () => {
    it('should update a shift (admin)', async () => {
      // First create a shift
      const createShiftDto = {
        name: 'Test Shift for PATCH',
        description: 'Test Shift Description',
        startTime: '2023-06-03T09:00:00.000Z',
        endTime: '2023-06-03T17:00:00.000Z',
        dayOfWeek: DayOfWeek.WEDNESDAY,
        campId: campId,
      };

      const createResponse = await supertest(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto);

      const shiftId = createResponse.body.id;

      // Then update it
      const updateShiftDto = {
        name: 'Updated Shift',
        description: 'Updated Description',
        startTime: '2023-06-03T10:00:00.000Z',
        endTime: '2023-06-03T18:00:00.000Z',
      };

      const response = await supertest(app.getHttpServer())
        .patch(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateShiftDto)
        .expect(200);

      expect(response.body.id).toBe(shiftId);
      expect(response.body.name).toBe(updateShiftDto.name);
      expect(response.body.description).toBe(updateShiftDto.description);
      expect(new Date(response.body.startTime).toISOString()).toBe(
        updateShiftDto.startTime,
      );
      expect(new Date(response.body.endTime).toISOString()).toBe(
        updateShiftDto.endTime,
      );
    });

    it('should not update a shift (non-admin)', async () => {
      // First create a shift
      const createShiftDto = {
        name: 'Test Shift for non-admin PATCH',
        description: 'Test Shift Description',
        startTime: '2023-06-04T09:00:00.000Z',
        endTime: '2023-06-04T17:00:00.000Z',
        dayOfWeek: DayOfWeek.THURSDAY,
        campId: campId,
      };

      const createResponse = await supertest(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto);

      const shiftId = createResponse.body.id;

      // Then try to update it as non-admin
      const updateShiftDto = {
        name: 'Unauthorized Update',
      };

      await supertest(app.getHttpServer())
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
        name: 'Test Shift for DELETE',
        description: 'Test Shift Description',
        startTime: '2023-06-05T09:00:00.000Z',
        endTime: '2023-06-05T17:00:00.000Z',
        dayOfWeek: DayOfWeek.FRIDAY,
        campId: campId,
      };

      const createResponse = await supertest(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto);

      const shiftId = createResponse.body.id;

      // Then delete it
      await supertest(app.getHttpServer())
        .delete(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify it's deleted
      await supertest(app.getHttpServer())
        .get(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should not delete a shift (non-admin)', async () => {
      // First create a shift
      const createShiftDto = {
        name: 'Test Shift for non-admin DELETE',
        description: 'Test Shift Description',
        startTime: '2023-06-06T09:00:00.000Z',
        endTime: '2023-06-06T17:00:00.000Z',
        dayOfWeek: DayOfWeek.SATURDAY,
        campId: campId,
      };

      const createResponse = await supertest(app.getHttpServer())
        .post('/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createShiftDto);

      const shiftId = createResponse.body.id;

      // Then try to delete it as non-admin
      await supertest(app.getHttpServer())
        .delete(`/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
}); 