import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

describe('CoreConfigController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prismaService: PrismaService;
  let adminToken: string;
  let userToken: string;
  let testConfigId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    
    await app.init();

    prismaService = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // Create test admin user
    const adminUser = await prismaService.user.upsert({
      where: { email: 'admin-test@example.com' },
      update: { role: UserRole.ADMIN },
      create: {
        id: uuidv4(),
        email: 'admin-test@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        isEmailVerified: true,
      },
    });

    // Create test regular user
    const regularUser = await prismaService.user.upsert({
      where: { email: 'user-test@example.com' },
      update: { role: UserRole.PARTICIPANT },
      create: {
        id: uuidv4(),
        email: 'user-test@example.com',
        firstName: 'Regular',
        lastName: 'User',
        role: UserRole.PARTICIPANT,
        isEmailVerified: true,
      },
    });

    // Create JWT tokens
    adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: adminUser.role,
    });

    userToken = jwtService.sign({
      sub: regularUser.id,
      email: regularUser.email,
      firstName: regularUser.firstName,
      lastName: regularUser.lastName,
      role: regularUser.role,
    });

    // Clean up any existing config data
    await prismaService.$executeRaw`TRUNCATE TABLE "core_config" CASCADE`;
  });

  afterAll(async () => {
    // Clean up
    await prismaService.$executeRaw`TRUNCATE TABLE "core_config" CASCADE`;
    await app.close();
  });

  it('should require authentication for all endpoints', () => {
    return request(app.getHttpServer())
      .get('/core-config/current')
      .expect(401);
  });

  describe('CRUD operations (admin only)', () => {
    it('should create a new core configuration (admin only)', async () => {
      const createDto = {
        campName: 'Test Camp',
        registrationYear: 2023,
        timeZone: 'America/Los_Angeles',
      };

      const response = await request(app.getHttpServer())
        .post('/core-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.campName).toBe(createDto.campName);
      expect(response.body.registrationYear).toBe(createDto.registrationYear);
      expect(response.body.timeZone).toBe(createDto.timeZone);

      // Save the ID for later tests
      testConfigId = response.body.id;
    });

    it('should not allow regular users to create a configuration', async () => {
      const createDto = {
        campName: 'Test Camp 2',
        registrationYear: 2024,
        timeZone: 'America/New_York',
      };

      return request(app.getHttpServer())
        .post('/core-config')
        .set('Authorization', `Bearer ${userToken}`)
        .send(createDto)
        .expect(403);
    });

    it('should get all configurations (admin only)', async () => {
      const response = await request(app.getHttpServer())
        .get('/core-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should not allow regular users to get all configurations', async () => {
      return request(app.getHttpServer())
        .get('/core-config')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should get configuration by ID (admin only)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/core-config/${testConfigId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(testConfigId);
    });

    it('should not allow regular users to get configuration by ID', async () => {
      return request(app.getHttpServer())
        .get(`/core-config/${testConfigId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should update a configuration (admin only)', async () => {
      const updateDto = {
        campName: 'Updated Camp Name',
        registrationOpen: true
      };

      const response = await request(app.getHttpServer())
        .patch(`/core-config/${testConfigId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(testConfigId);
      expect(response.body.campName).toBe(updateDto.campName);
      expect(response.body.registrationOpen).toBe(updateDto.registrationOpen);
    });

    it('should not allow regular users to update a configuration', async () => {
      const updateDto = {
        campName: 'Should Not Update'
      };

      return request(app.getHttpServer())
        .patch(`/core-config/${testConfigId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateDto)
        .expect(403);
    });

    it('should delete a configuration (admin only)', async () => {
      // First create another config to delete
      const createDto = {
        campName: 'Config To Delete',
        registrationYear: 2023,
        timeZone: 'America/New_York',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/core-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(201);

      const configIdToDelete = createResponse.body.id;

      // Now delete it
      const response = await request(app.getHttpServer())
        .delete(`/core-config/${configIdToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(configIdToDelete);
    });

    it('should not allow regular users to delete a configuration', async () => {
      return request(app.getHttpServer())
        .delete(`/core-config/${testConfigId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Current configuration', () => {
    it('should get current configuration (accessible to all authenticated users)', async () => {
      // Regular user should be able to get current config
      const response = await request(app.getHttpServer())
        .get('/core-config/current')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(testConfigId);
      
      // Sensitive fields should be excluded
      expect(response.body.stripeApiKey).toBeUndefined();
      expect(response.body.stripeWebhookSecret).toBeUndefined();
      expect(response.body.paypalClientSecret).toBeUndefined();
      expect(response.body.smtpPassword).toBeUndefined();
    });
  });

  describe('Admin test endpoint', () => {
    it('should provide a test endpoint for admins', async () => {
      return request(app.getHttpServer())
        .get('/core-config/admin/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should not allow regular users to access the test endpoint', async () => {
      return request(app.getHttpServer())
        .get('/core-config/admin/test')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
}); 