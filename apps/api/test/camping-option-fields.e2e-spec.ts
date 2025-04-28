import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole, FieldType } from '@prisma/client';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue(true),
}));

describe('CampingOptionFieldsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let testCampId: string;
  let testCampingOptionId: string;

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
        name: 'Test Camp for Fields',
        startDate: new Date('2023-08-01'),
        endDate: new Date('2023-08-07'),
        description: 'Test Camp Description',
        location: 'Test Location',
        capacity: 100,
      },
    });
    testCampId = camp.id;

    // Create a test camping option
    const campingOption = await prisma.$queryRawUnsafe(`
      INSERT INTO "camping_options"
      (id, name, description, enabled, "workShiftsRequired", "participantDues", "staffDues", "maxSignups", "campId", "jobCategoryIds", "createdAt", "updatedAt")
      VALUES
      (
        gen_random_uuid(),
        'Test Camping Option for Fields',
        'Test Description',
        true,
        1,
        200.00,
        100.00,
        30,
        '${testCampId}',
        '{}',
        now(),
        now()
      )
      RETURNING *
    `);

    testCampingOptionId = campingOption[0].id;

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
    // Clean up test data
    // First delete camping option
    await prisma.$queryRawUnsafe(`
      DELETE FROM "camping_options" WHERE id = '${testCampingOptionId}'
    `).catch(() => {
      // Ignore errors if already deleted
    });

    // Then delete camp
    await prisma.camp.delete({
      where: { id: testCampId },
    }).catch(() => {
      // Ignore errors if already deleted
    });
    
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /camping-option-fields', () => {
    it('should create a camping option field (admin)', async () => {
      const createFieldDto = {
        displayName: 'Dietary Restrictions',
        description: 'Please list any dietary restrictions or allergies',
        dataType: FieldType.STRING,
        required: true,
        maxLength: 255,
        campingOptionId: testCampingOptionId,
      };

      const response = await request(app.getHttpServer())
        .post('/camping-option-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createFieldDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.displayName).toBe(createFieldDto.displayName);
      expect(response.body.description).toBe(createFieldDto.description);
      expect(response.body.dataType).toBe(createFieldDto.dataType);
      expect(response.body.required).toBe(createFieldDto.required);
      expect(response.body.maxLength).toBe(createFieldDto.maxLength);
      expect(response.body.campingOptionId).toBe(createFieldDto.campingOptionId);
    });

    it('should not create a camping option field (non-admin)', async () => {
      const createFieldDto = {
        displayName: 'Medical Needs',
        description: 'Please list any medical needs',
        dataType: FieldType.STRING,
        required: false,
        maxLength: 255,
        campingOptionId: testCampingOptionId,
      };

      await request(app.getHttpServer())
        .post('/camping-option-fields')
        .set('Authorization', `Bearer ${userToken}`)
        .send(createFieldDto)
        .expect(403);
    });
  });

  describe('GET /camping-option-fields/by-camping-option/:campingOptionId', () => {
    it('should return all fields for a camping option', async () => {
      const response = await request(app.getHttpServer())
        .get(`/camping-option-fields/by-camping-option/${testCampingOptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /camping-option-fields/:id', () => {
    let fieldId: string;

    beforeAll(async () => {
      // Create a field to test with
      const field = await prisma.$queryRawUnsafe(`
        INSERT INTO "camping_option_fields"
        (id, "displayName", description, "dataType", required, "maxLength", "minValue", "maxValue", "campingOptionId", "createdAt", "updatedAt")
        VALUES
        (
          gen_random_uuid(),
          'Test Field for GET',
          'Field for testing GET',
          'STRING',
          true,
          100,
          NULL,
          NULL,
          '${testCampingOptionId}',
          now(),
          now()
        )
        RETURNING *
      `);

      fieldId = field[0].id;
    });

    it('should return a field by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/camping-option-fields/${fieldId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(fieldId);
      expect(response.body.displayName).toBe('Test Field for GET');
    });

    it('should return 404 for non-existent field', async () => {
      await request(app.getHttpServer())
        .get('/camping-option-fields/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('PATCH /camping-option-fields/:id', () => {
    let fieldId: string;

    beforeAll(async () => {
      // Create a field to test with
      const field = await prisma.$queryRawUnsafe(`
        INSERT INTO "camping_option_fields"
        (id, "displayName", description, "dataType", required, "maxLength", "minValue", "maxValue", "campingOptionId", "createdAt", "updatedAt")
        VALUES
        (
          gen_random_uuid(),
          'Test Field for PATCH',
          'Field for testing PATCH',
          'STRING',
          false,
          100,
          NULL,
          NULL,
          '${testCampingOptionId}',
          now(),
          now()
        )
        RETURNING *
      `);

      fieldId = field[0].id;
    });

    it('should update a field (admin)', async () => {
      const updateFieldDto = {
        displayName: 'Updated Field Name',
        description: 'Updated description',
        required: true,
        maxLength: 200,
      };

      const response = await request(app.getHttpServer())
        .patch(`/camping-option-fields/${fieldId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateFieldDto)
        .expect(200);

      expect(response.body.id).toBe(fieldId);
      expect(response.body.displayName).toBe(updateFieldDto.displayName);
      expect(response.body.description).toBe(updateFieldDto.description);
      expect(response.body.required).toBe(updateFieldDto.required);
      expect(response.body.maxLength).toBe(updateFieldDto.maxLength);
    });

    it('should not update a field (non-admin)', async () => {
      const updateFieldDto = {
        displayName: 'Hacker Update',
      };

      await request(app.getHttpServer())
        .patch(`/camping-option-fields/${fieldId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateFieldDto)
        .expect(403);
    });
  });

  describe('DELETE /camping-option-fields/:id', () => {
    let fieldId: string;

    beforeEach(async () => {
      // Create a field to test with
      const field = await prisma.$queryRawUnsafe(`
        INSERT INTO "camping_option_fields"
        (id, "displayName", description, "dataType", required, "maxLength", "minValue", "maxValue", "campingOptionId", "createdAt", "updatedAt")
        VALUES
        (
          gen_random_uuid(),
          'Test Field for DELETE',
          'Field for testing DELETE',
          'STRING',
          false,
          100,
          NULL,
          NULL,
          '${testCampingOptionId}',
          now(),
          now()
        )
        RETURNING *
      `);

      fieldId = field[0].id;
    });

    it('should delete a field (admin)', async () => {
      await request(app.getHttpServer())
        .delete(`/camping-option-fields/${fieldId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify it was deleted
      await request(app.getHttpServer())
        .get(`/camping-option-fields/${fieldId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should not delete a field (non-admin)', async () => {
      await request(app.getHttpServer())
        .delete(`/camping-option-fields/${fieldId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
}); 