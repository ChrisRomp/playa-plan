import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('JobsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /jobs', () => {
    it('should create a job (admin)', async () => {
      const createJobDto = {
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
      };

      const response = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createJobDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createJobDto.name);
      expect(response.body.description).toBe(createJobDto.description);
      expect(response.body.location).toBe(createJobDto.location);
    });

    it('should not create a job (non-admin)', async () => {
      const createJobDto = {
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
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
    it('should return a job by id', async () => {
      // First create a job
      const createJobDto = {
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createJobDto);

      const jobId = createResponse.body.id;

      // Then get it
      const response = await request(app.getHttpServer())
        .get(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(jobId);
      expect(response.body.name).toBe(createJobDto.name);
    });

    it('should return 404 for non-existent job', async () => {
      await request(app.getHttpServer())
        .get('/jobs/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('PATCH /jobs/:id', () => {
    it('should update a job (admin)', async () => {
      // First create a job
      const createJobDto = {
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createJobDto);

      const jobId = createResponse.body.id;

      // Then update it
      const updateJobDto = {
        name: 'Updated Job',
        description: 'Updated Description',
        location: 'Updated Location',
      };

      const response = await request(app.getHttpServer())
        .patch(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateJobDto)
        .expect(200);

      expect(response.body.id).toBe(jobId);
      expect(response.body.name).toBe(updateJobDto.name);
      expect(response.body.description).toBe(updateJobDto.description);
      expect(response.body.location).toBe(updateJobDto.location);
    });

    it('should not update a job (non-admin)', async () => {
      // First create a job
      const createJobDto = {
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createJobDto);

      const jobId = createResponse.body.id;

      // Then try to update it as non-admin
      const updateJobDto = {
        name: 'Updated Job',
      };

      await request(app.getHttpServer())
        .patch(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateJobDto)
        .expect(403);
    });
  });

  describe('DELETE /jobs/:id', () => {
    it('should delete a job (admin)', async () => {
      // First create a job
      const createJobDto = {
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createJobDto);

      const jobId = createResponse.body.id;

      // Then delete it
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
      // First create a job
      const createJobDto = {
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createJobDto);

      const jobId = createResponse.body.id;

      // Then try to delete it as non-admin
      await request(app.getHttpServer())
        .delete(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
}); 