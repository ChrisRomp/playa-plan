import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@prisma/client';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue(true),
}));

describe('CampingOptionsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let testCampId: string;
  let testJobCategoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);

    await app.init();

    // Create test data
    // Create a test camp
    const camp = await prisma.camp.create({
      data: {
        name: 'Test Camp',
        startDate: new Date('2023-08-01'),
        endDate: new Date('2023-08-07'),
        description: 'Test Camp Description',
      },
    });
    testCampId = camp.id;

    // Create a test job category
    const category = await prisma.jobCategory.create({
      data: {
        name: 'Test Category for Camping Options',
        description: 'Test Category Description',
        location: 'Test Location',
      },
    });
    testJobCategoryId = category.id;

    // Ensure test users exist
    let admin = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
    });

    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          password: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', // 'admin123'
          firstName: 'Admin',
          lastName: 'User',
          role: UserRole.ADMIN,
          isEmailVerified: true,
        },
      });
    }

    let user = await prisma.user.findUnique({
      where: { email: 'user@example.com' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'user@example.com',
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
        email: 'admin@example.com',
        password: 'admin123',
      });

    adminToken = adminResponse.body.accessToken;

    const userResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'user123',
      });

    userToken = userResponse.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.jobCategory.delete({
      where: { id: testJobCategoryId },
    }).catch(() => {
      // Ignore errors if already deleted
    });

    await prisma.camp.delete({
      where: { id: testCampId },
    }).catch(() => {
      // Ignore errors if already deleted
    });
    
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /camping-options', () => {
    it('should create a camping option (admin)', async () => {
      const createCampingOptionDto = {
        name: 'Standard Camping',
        description: 'Standard camping option with shared facilities',
        enabled: true,
        workShiftsRequired: 2,
        participantDues: 250.00,
        staffDues: 150.00,
        maxSignups: 50,
        campId: testCampId,
        jobCategoryIds: [testJobCategoryId],
      };

      const response = await request(app.getHttpServer())
        .post('/camping-options')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createCampingOptionDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createCampingOptionDto.name);
      expect(response.body.description).toBe(createCampingOptionDto.description);
      expect(response.body.workShiftsRequired).toBe(createCampingOptionDto.workShiftsRequired);
      expect(response.body.participantDues).toBe(createCampingOptionDto.participantDues);
      expect(response.body.staffDues).toBe(createCampingOptionDto.staffDues);
      expect(response.body.maxSignups).toBe(createCampingOptionDto.maxSignups);
      expect(response.body.campId).toBe(createCampingOptionDto.campId);
      expect(response.body.jobCategoryIds).toEqual(expect.arrayContaining(createCampingOptionDto.jobCategoryIds));
      expect(response.body.currentRegistrations).toBe(0);
      expect(response.body.availabilityStatus).toBe(true);
    });

    it('should not create a camping option (non-admin)', async () => {
      const createCampingOptionDto = {
        name: 'Premium Camping',
        description: 'Premium camping option with private facilities',
        enabled: true,
        workShiftsRequired: 1,
        participantDues: 350.00,
        staffDues: 200.00,
        maxSignups: 20,
        campId: testCampId,
        jobCategoryIds: [testJobCategoryId],
      };

      await request(app.getHttpServer())
        .post('/camping-options')
        .set('Authorization', `Bearer ${userToken}`)
        .send(createCampingOptionDto)
        .expect(403);
    });
  });

  describe('GET /camping-options', () => {
    it('should return all camping options', async () => {
      const response = await request(app.getHttpServer())
        .get('/camping-options')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter camping options by campId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/camping-options?campId=${testCampId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // All returned options should have the correct campId
      for (const option of response.body) {
        expect(option.campId).toBe(testCampId);
      }
    });
  });

  describe('GET /camping-options/:id', () => {
    let campingOptionId: string;

    beforeAll(async () => {
      // Create a camping option to test with
      const campingOption = await prisma.$queryRawUnsafe(`
        INSERT INTO "camping_options"
        (id, name, description, enabled, "workShiftsRequired", "participantDues", "staffDues", "maxSignups", "campId", "jobCategoryIds", "createdAt", "updatedAt")
        VALUES
        (
          gen_random_uuid(),
          'Test Camping Option for GET',
          'Test Description',
          true,
          1,
          200.00,
          100.00,
          30,
          '${testCampId}',
          '{"${testJobCategoryId}"}',
          now(),
          now()
        )
        RETURNING *
      `);

      campingOptionId = campingOption[0].id;
    });

    it('should return a camping option by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/camping-options/${campingOptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(campingOptionId);
      expect(response.body.name).toBe('Test Camping Option for GET');
    });

    it('should return 404 for non-existent camping option', async () => {
      await request(app.getHttpServer())
        .get('/camping-options/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('PATCH /camping-options/:id', () => {
    let campingOptionId: string;

    beforeAll(async () => {
      // Create a camping option to test with
      const campingOption = await prisma.$queryRawUnsafe(`
        INSERT INTO "camping_options"
        (id, name, description, enabled, "workShiftsRequired", "participantDues", "staffDues", "maxSignups", "campId", "jobCategoryIds", "createdAt", "updatedAt")
        VALUES
        (
          gen_random_uuid(),
          'Test Camping Option for PATCH',
          'Test Description',
          true,
          1,
          200.00,
          100.00,
          30,
          '${testCampId}',
          '{"${testJobCategoryId}"}',
          now(),
          now()
        )
        RETURNING *
      `);

      campingOptionId = campingOption[0].id;
    });

    it('should update a camping option (admin)', async () => {
      const updateCampingOptionDto = {
        name: 'Updated Camping Option',
        description: 'Updated Description',
        enabled: false,
        workShiftsRequired: 3,
        participantDues: 275.00,
        staffDues: 175.00,
        maxSignups: 40,
      };

      const response = await request(app.getHttpServer())
        .patch(`/camping-options/${campingOptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateCampingOptionDto)
        .expect(200);

      expect(response.body.id).toBe(campingOptionId);
      expect(response.body.name).toBe(updateCampingOptionDto.name);
      expect(response.body.description).toBe(updateCampingOptionDto.description);
      expect(response.body.enabled).toBe(updateCampingOptionDto.enabled);
      expect(response.body.workShiftsRequired).toBe(updateCampingOptionDto.workShiftsRequired);
      expect(response.body.participantDues).toBe(updateCampingOptionDto.participantDues);
      expect(response.body.staffDues).toBe(updateCampingOptionDto.staffDues);
      expect(response.body.maxSignups).toBe(updateCampingOptionDto.maxSignups);
    });

    it('should not update a camping option (non-admin)', async () => {
      const updateCampingOptionDto = {
        name: 'Hacker Update',
      };

      await request(app.getHttpServer())
        .patch(`/camping-options/${campingOptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateCampingOptionDto)
        .expect(403);
    });
  });

  describe('DELETE /camping-options/:id', () => {
    let campingOptionId: string;

    beforeEach(async () => {
      // Create a camping option to test with
      const campingOption = await prisma.$queryRawUnsafe(`
        INSERT INTO "camping_options"
        (id, name, description, enabled, "workShiftsRequired", "participantDues", "staffDues", "maxSignups", "campId", "jobCategoryIds", "createdAt", "updatedAt")
        VALUES
        (
          gen_random_uuid(),
          'Test Camping Option for DELETE',
          'Test Description',
          true,
          1,
          200.00,
          100.00,
          30,
          '${testCampId}',
          '{"${testJobCategoryId}"}',
          now(),
          now()
        )
        RETURNING *
      `);

      campingOptionId = campingOption[0].id;
    });

    it('should delete a camping option (admin)', async () => {
      await request(app.getHttpServer())
        .delete(`/camping-options/${campingOptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify it was deleted
      await request(app.getHttpServer())
        .get(`/camping-options/${campingOptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should not delete a camping option (non-admin)', async () => {
      await request(app.getHttpServer())
        .delete(`/camping-options/${campingOptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
}); 