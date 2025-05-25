import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole, FieldType } from '@prisma/client';

// Interface for raw camping option results
interface RawCampingOption {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  workShiftsRequired: number;
  participantDues: number;
  staffDues: number;
  maxSignups: number;
  campId: string;
  jobCategoryIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Interface for raw camping option field results
interface RawCampingOptionField {
  id: string;
  displayName: string;
  description: string | null;
  dataType: FieldType;
  required: boolean;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  campingOptionId: string;
  createdAt: Date;
  updatedAt: Date;
}

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
  let testCampingOptionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);

    await app.init();

    // Create test data
    // Create a test camping option (camp entity was removed from schema)
    const campingOption = await prisma.campingOption.create({
      data: {
        name: 'Test Camping Option for Fields',
        description: 'Test Description',
        enabled: true,
        workShiftsRequired: 1,
        participantDues: 200.00,
        staffDues: 100.00,
        maxSignups: 30,
      }
    });

    testCampingOptionId = campingOption.id;

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
    // Clean up test data
    // Delete camping option (will cascade to camping option fields)
    await prisma.campingOption.delete({
      where: { id: testCampingOptionId },
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
      const field = await prisma.campingOptionField.create({
        data: {
          displayName: 'Test Field for GET',
          description: 'Field for testing GET',
          dataType: 'STRING',
          required: true,
          maxLength: 100,
          campingOptionId: testCampingOptionId,
        }
      });

      fieldId = field.id;
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
      const field = await prisma.campingOptionField.create({
        data: {
          displayName: 'Test Field for PATCH',
          description: 'Field for testing PATCH',
          dataType: 'STRING',
          required: true,
          maxLength: 100,
          campingOptionId: testCampingOptionId,
        }
      });

      fieldId = field.id;
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
      const field = await prisma.campingOptionField.create({
        data: {
          displayName: 'Test Field for DELETE',
          description: 'Field for testing DELETE',
          dataType: 'STRING',
          required: true,
          maxLength: 100,
          campingOptionId: testCampingOptionId,
        }
      });

      fieldId = field.id;
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

  describe('PATCH /camping-option-fields/reorder/:campingOptionId', () => {
    let field1Id: string;
    let field2Id: string;
    let field3Id: string;

    beforeAll(async () => {
      // Create multiple fields to test reordering
      const field1 = await prisma.campingOptionField.create({
        data: {
          displayName: 'Field 1 for Reorder',
          description: 'First field',
          dataType: 'STRING',
          required: true,
          order: 0,
          campingOptionId: testCampingOptionId,
        }
      });

      const field2 = await prisma.campingOptionField.create({
        data: {
          displayName: 'Field 2 for Reorder',
          description: 'Second field',
          dataType: 'INTEGER',
          required: false,
          order: 1,
          campingOptionId: testCampingOptionId,
        }
      });

      const field3 = await prisma.campingOptionField.create({
        data: {
          displayName: 'Field 3 for Reorder',
          description: 'Third field',
          dataType: 'BOOLEAN',
          required: true,
          order: 2,
          campingOptionId: testCampingOptionId,
        }
      });

      field1Id = field1.id;
      field2Id = field2.id;
      field3Id = field3.id;
    });

    it('should reorder fields successfully (admin)', async () => {
      const reorderDto = {
        fieldOrders: [
          { id: field2Id, order: 0 },
          { id: field3Id, order: 1 },
          { id: field1Id, order: 2 }
        ]
      };

      const response = await request(app.getHttpServer())
        .patch(`/camping-option-fields/reorder/${testCampingOptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reorderDto)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);

      // Verify the new order
      const field2 = response.body.find((f: { id: string; order: number }) => f.id === field2Id);
      const field3 = response.body.find((f: { id: string; order: number }) => f.id === field3Id);
      const field1 = response.body.find((f: { id: string; order: number }) => f.id === field1Id);

      expect(field2?.order).toBe(0);
      expect(field3?.order).toBe(1);
      expect(field1?.order).toBe(2);
    });

    it('should not reorder fields (non-admin)', async () => {
      const reorderDto = {
        fieldOrders: [
          { id: field1Id, order: 0 },
          { id: field2Id, order: 1 }
        ]
      };

      await request(app.getHttpServer())
        .patch(`/camping-option-fields/reorder/${testCampingOptionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(reorderDto)
        .expect(403);
    });

    it('should return 404 for non-existent camping option', async () => {
      const reorderDto = {
        fieldOrders: [
          { id: field1Id, order: 0 }
        ]
      };

      await request(app.getHttpServer())
        .patch('/camping-option-fields/reorder/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reorderDto)
        .expect(404);
    });

    it('should return 400 for invalid field IDs', async () => {
      const reorderDto = {
        fieldOrders: [
          { id: '00000000-0000-0000-0000-000000000000', order: 0 }
        ]
      };

      await request(app.getHttpServer())
        .patch(`/camping-option-fields/reorder/${testCampingOptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reorderDto)
        .expect(400);
    });

    it('should return 400 for validation errors - invalid payload structure', async () => {
      // Test the exact error scenario from the user's report
      const invalidPayload = {
        // Missing fieldOrders property
        someOtherProperty: 'invalid'
      };

      const response = await request(app.getHttpServer())
        .patch(`/camping-option-fields/reorder/${testCampingOptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPayload)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should return 400 for validation errors - invalid field ID format', async () => {
      const invalidPayload = {
        fieldOrders: [
          { id: 'not-a-uuid', order: 0 }
        ]
      };

      const response = await request(app.getHttpServer())
        .patch(`/camping-option-fields/reorder/${testCampingOptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPayload)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(Array.isArray(response.body.message)).toBe(true);
      expect(response.body.message.some((msg: string) => msg.includes('must be a UUID'))).toBe(true);
    });

    it('should return 400 for validation errors - negative order value', async () => {
      const invalidPayload = {
        fieldOrders: [
          { id: field1Id, order: -1 }
        ]
      };

      const response = await request(app.getHttpServer())
        .patch(`/camping-option-fields/reorder/${testCampingOptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPayload)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(Array.isArray(response.body.message)).toBe(true);
      expect(response.body.message.some((msg: string) => msg.includes('must not be less than 0'))).toBe(true);
    });

    it('should return 400 for validation errors - missing required fields', async () => {
      const invalidPayload = {
        fieldOrders: [
          { id: field1Id } // Missing order property
        ]
      };

      const response = await request(app.getHttpServer())
        .patch(`/camping-option-fields/reorder/${testCampingOptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPayload)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(Array.isArray(response.body.message)).toBe(true);
      expect(response.body.message.some((msg: string) => msg.includes('order'))).toBe(true);
    });
  });
}); 