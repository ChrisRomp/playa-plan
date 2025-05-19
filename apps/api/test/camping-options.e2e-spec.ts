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
        location: 'Test Location',
        capacity: 100,
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
      // Create a camping option to test with using Prisma ORM
      const campingOption = await prisma.campingOption.create({
        data: {
          name: 'Test Camping Option for GET',
          description: 'Test Description',
          enabled: true,
          workShiftsRequired: 1,
          participantDues: 200.00,
          staffDues: 100.00,
          maxSignups: 30,
          campId: testCampId,
          jobCategoryIds: [testJobCategoryId],
        },
      });

      campingOptionId = campingOption.id;
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
      // Create a camping option to test with using Prisma ORM
      const campingOption = await prisma.campingOption.create({
        data: {
          name: 'Test Camping Option for PATCH',
          description: 'Test Description',
          enabled: true,
          workShiftsRequired: 1,
          participantDues: 200.00,
          staffDues: 100.00,
          maxSignups: 30,
          campId: testCampId,
          jobCategoryIds: [testJobCategoryId],
        },
      });

      campingOptionId = campingOption.id;
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
      // Create a camping option to test with using Prisma ORM
      const campingOption = await prisma.campingOption.create({
        data: {
          name: 'Test Camping Option for DELETE',
          description: 'Test Description',
          enabled: true,
          workShiftsRequired: 1,
          participantDues: 200.00,
          staffDues: 100.00,
          maxSignups: 30,
          campId: testCampId,
          jobCategoryIds: [testJobCategoryId],
        },
      });

      campingOptionId = campingOption.id;
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

  describe('Camping Option Fields Endpoints', () => {
    let testFieldId: string;
    let testCampingOptionId: string;
    
    beforeAll(async () => {
      // Create a camping option to test fields with
      const campingOption = await prisma.campingOption.create({
        data: {
          name: 'Test Camping Option for Fields',
          description: 'Test Description for Fields',
          enabled: true,
          workShiftsRequired: 1,
          participantDues: 200.00,
          staffDues: 100.00,
          maxSignups: 30,
          campId: testCampId,
          jobCategoryIds: [testJobCategoryId],
        },
      });

      testCampingOptionId = campingOption.id;
    });
    
    it('should create a camping option field (admin)', async () => {
      const createFieldDto = {
        displayName: 'Test Field',
        description: 'A test field for camping option',
        dataType: 'TEXT',
        required: true,
        maxLength: 100
      };
      
      const response = await request(app.getHttpServer())
        .post(`/camping-options/${testCampingOptionId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createFieldDto)
        .expect(201);
        
      expect(response.body.displayName).toBe(createFieldDto.displayName);
      expect(response.body.dataType).toBe(createFieldDto.dataType);
      expect(response.body.campingOptionId).toBe(testCampingOptionId);
      
      testFieldId = response.body.id;
    });
    
    it('should not create a camping option field (non-admin)', async () => {
      const createFieldDto = {
        displayName: 'Test Field',
        description: 'A test field for camping option',
        dataType: 'TEXT',
        required: true,
        maxLength: 100
      };
      
      await request(app.getHttpServer())
        .post(`/camping-options/${testCampingOptionId}/fields`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(createFieldDto)
        .expect(403);
    });
    
    it('should get all fields for a camping option', async () => {
      const response = await request(app.getHttpServer())
        .get(`/camping-options/${testCampingOptionId}/fields`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
        
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Field should be in the response
      const foundField = response.body.find((field: { id: string }) => field.id === testFieldId);
      expect(foundField).toBeDefined();
    });
    
    it('should update a camping option field (admin)', async () => {
      const updateFieldDto = {
        displayName: 'Updated Field Name',
        required: false
      };
      
      const response = await request(app.getHttpServer())
        .patch(`/camping-options/${testCampingOptionId}/fields/${testFieldId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateFieldDto)
        .expect(200);
        
      expect(response.body.displayName).toBe(updateFieldDto.displayName);
      expect(response.body.required).toBe(updateFieldDto.required);
    });
    
    it('should not update a camping option field (non-admin)', async () => {
      const updateFieldDto = {
        displayName: 'Should Not Update'
      };
      
      await request(app.getHttpServer())
        .patch(`/camping-options/${testCampingOptionId}/fields/${testFieldId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateFieldDto)
        .expect(403);
    });
    
    it('should delete a camping option field (admin)', async () => {
      await request(app.getHttpServer())
        .delete(`/camping-options/${testCampingOptionId}/fields/${testFieldId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
        
      // Verify it's deleted
      const response = await request(app.getHttpServer())
        .get(`/camping-options/${testCampingOptionId}/fields`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
        
      const foundField = response.body.find((field: { id: string }) => field.id === testFieldId);
      expect(foundField).toBeUndefined();
    });
    
    it('should not delete a camping option field (non-admin)', async () => {
      // Create a new field to delete
      const createFieldDto = {
        displayName: 'Field To Delete',
        dataType: 'TEXT'
      };
      
      const createResponse = await request(app.getHttpServer())
        .post(`/camping-options/${testCampingOptionId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createFieldDto)
        .expect(201);
        
      const fieldToDeleteId = createResponse.body.id;
      
      // Try to delete as non-admin user
      await request(app.getHttpServer())
        .delete(`/camping-options/${testCampingOptionId}/fields/${fieldToDeleteId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
      
      // Clean up
      await request(app.getHttpServer())
        .delete(`/camping-options/${testCampingOptionId}/fields/${fieldToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
}); 