import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RegistrationStatus } from '@prisma/client';

/**
 * Migration Validation Tests
 * 
 * These tests validate that the database migration to remove the unique constraint
 * on (userId, year) works correctly and users can register again after cancellation.
 * 
 * Migration: 20250606011250_remove_unique_constraint_user_id_year
 */
describe('Migration Validation - Re-registration after cancellation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let testUserId: string;
  let testYear: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    testYear = new Date().getFullYear();

    // Create test user and get auth tokens
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up registrations between tests
    await prisma.registration.deleteMany({
      where: { userId: testUserId, year: testYear }
    });
  });

  describe('Database Migration Validation', () => {
    it('should allow multiple registrations per user per year (constraint removed)', async () => {
      // Create first registration
      const firstRegistration = await prisma.registration.create({
        data: {
          userId: testUserId,
          year: testYear,
          status: RegistrationStatus.CONFIRMED
        }
      });

      // Cancel the first registration
      await prisma.registration.update({
        where: { id: firstRegistration.id },
        data: { status: RegistrationStatus.CANCELLED }
      });

      // Create second registration for same user/year (should succeed after migration)
      const secondRegistration = await prisma.registration.create({
        data: {
          userId: testUserId,
          year: testYear,
          status: RegistrationStatus.PENDING
        }
      });

      expect(secondRegistration).toBeDefined();
      expect(secondRegistration.id).not.toBe(firstRegistration.id);
      expect(secondRegistration.userId).toBe(testUserId);
      expect(secondRegistration.year).toBe(testYear);
      expect(secondRegistration.status).toBe(RegistrationStatus.PENDING);

      // Verify both registrations exist
      const allRegistrations = await prisma.registration.findMany({
        where: { userId: testUserId, year: testYear }
      });

      expect(allRegistrations).toHaveLength(2);
      expect(allRegistrations.some(r => r.status === RegistrationStatus.CANCELLED)).toBe(true);
      expect(allRegistrations.some(r => r.status === RegistrationStatus.PENDING)).toBe(true);
    });

    it('should handle registrations for different years correctly', async () => {
      // Create registrations for different years (should always work)
      const reg2023 = await prisma.registration.create({
        data: {
          userId: testUserId,
          year: 2023,
          status: RegistrationStatus.CONFIRMED
        }
      });

      const reg2024 = await prisma.registration.create({
        data: {
          userId: testUserId,
          year: 2024,
          status: RegistrationStatus.CONFIRMED
        }
      });

      // Both should exist and be valid
      expect(reg2023.year).toBe(2023);
      expect(reg2024.year).toBe(2024);
      
      const userRegistrations = await prisma.registration.findMany({
        where: { userId: testUserId }
      });

      expect(userRegistrations.length).toBeGreaterThanOrEqual(2);
    });

    it('should maintain data integrity with payments', async () => {
      // Create registration with payment
      const registration = await prisma.registration.create({
        data: {
          userId: testUserId,
          year: testYear,
          status: RegistrationStatus.CONFIRMED
        }
      });

      // Add payment
      const payment = await prisma.payment.create({
        data: {
          userId: testUserId,
          registrationId: registration.id,
          amount: 100,
          currency: 'USD',
          status: 'COMPLETED',
          provider: 'STRIPE',
          providerRefId: 'test-payment-id'
        }
      });

      // Cancel registration
      await prisma.registration.update({
        where: { id: registration.id },
        data: { status: RegistrationStatus.CANCELLED }
      });

      // Create new registration
      const newRegistration = await prisma.registration.create({
        data: {
          userId: testUserId,
          year: testYear,
          status: RegistrationStatus.PENDING
        }
      });

      // Verify old payment is still linked to old registration
      const oldPayment = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: { registration: true }
      });

      expect(oldPayment).toBeDefined();
      expect(oldPayment?.registrationId).toBe(registration.id);
      expect(oldPayment?.registration?.status).toBe(RegistrationStatus.CANCELLED);

      // Verify new registration has no payments
      const newRegPayments = await prisma.payment.findMany({
        where: { registrationId: newRegistration.id }
      });

      expect(newRegPayments).toHaveLength(0);
    });
  });

  describe('API Validation - Re-registration Flow', () => {
    it('should allow user to register again after cancellation via API', async () => {
      // 1. Create initial registration
      const createResponse = await request(app.getHttpServer())
        .post('/registrations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          year: testYear,
          jobIds: []
        })
        .expect(201);

      const initialRegistrationId = createResponse.body.id;
      expect(createResponse.body.status).toBe(RegistrationStatus.PENDING);

      // 2. Admin cancels the registration
      await request(app.getHttpServer())
        .patch(`/admin/registrations/${initialRegistrationId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Test cancellation for migration validation'
        })
        .expect(200);

      // 3. User should be able to register again
      const newRegistrationResponse = await request(app.getHttpServer())
        .post('/registrations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          year: testYear,
          jobIds: []
        })
        .expect(201);

      expect(newRegistrationResponse.body.id).not.toBe(initialRegistrationId);
      expect(newRegistrationResponse.body.status).toBe(RegistrationStatus.PENDING);

      // 4. Verify both registrations exist in database
      const userRegistrations = await request(app.getHttpServer())
        .get('/registrations/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const currentYearRegistrations = userRegistrations.body.filter(r => r.year === testYear);
      expect(currentYearRegistrations).toHaveLength(2);
      expect(currentYearRegistrations.some(r => r.status === RegistrationStatus.CANCELLED)).toBe(true);
      expect(currentYearRegistrations.some(r => r.status === RegistrationStatus.PENDING)).toBe(true);
    });

    it('should prevent registration when user has active registration', async () => {
      // Create active registration
      await request(app.getHttpServer())
        .post('/registrations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          year: testYear,
          jobIds: []
        })
        .expect(201);

      // Attempt to create another registration should fail
      await request(app.getHttpServer())
        .post('/registrations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          year: testYear,
          jobIds: []
        })
        .expect(409); // Conflict
    });

    it('should handle concurrent registration attempts correctly', async () => {
      // Create cancelled registration
      await prisma.registration.create({
        data: {
          userId: testUserId,
          year: testYear,
          status: RegistrationStatus.CANCELLED
        }
      });

      // Make concurrent registration requests
      const promises = Array(3).fill(0).map(() =>
        request(app.getHttpServer())
          .post('/registrations')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            year: testYear,
            jobIds: []
          })
      );

      const results = await Promise.allSettled(promises);
      
      // Only one should succeed, others should fail
      const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 201);
      const failures = results.filter(r => r.status === 'fulfilled' && r.value.status === 409);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(2);
    });
  });

  describe('Admin Interface Validation', () => {
    it('should show all registrations including cancelled in admin view', async () => {
      // Create multiple registrations
      await prisma.registration.createMany({
        data: [
          { userId: testUserId, year: testYear, status: RegistrationStatus.CANCELLED },
          { userId: testUserId, year: testYear, status: RegistrationStatus.CONFIRMED },
          { userId: testUserId, year: testYear - 1, status: RegistrationStatus.CONFIRMED }
        ]
      });

      const adminResponse = await request(app.getHttpServer())
        .get('/admin/registrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ userId: testUserId })
        .expect(200);

      expect(adminResponse.body.registrations.length).toBeGreaterThanOrEqual(3);
      expect(adminResponse.body.registrations.some(r => r.status === RegistrationStatus.CANCELLED)).toBe(true);
      expect(adminResponse.body.registrations.some(r => r.status === RegistrationStatus.CONFIRMED)).toBe(true);
    });

    it('should handle pagination with multiple registrations per user', async () => {
      // Create many registrations for testing pagination
      const registrationsData: Array<{
        userId: string;
        year: number;
        status: RegistrationStatus;
      }> = [];
      for (let i = 0; i < 5; i++) {
        registrationsData.push({
          userId: testUserId,
          year: testYear,
          status: i % 2 === 0 ? RegistrationStatus.CANCELLED : RegistrationStatus.CONFIRMED
        });
      }

      await prisma.registration.createMany({ data: registrationsData });

      const response = await request(app.getHttpServer())
        .get('/admin/registrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10, userId: testUserId })
        .expect(200);

      expect(response.body.registrations.length).toBeGreaterThanOrEqual(5);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('Data Integrity Validation', () => {
    it('should maintain referential integrity with payments and jobs', async () => {
      // Create registration with related data
      const registration = await prisma.registration.create({
        data: {
          userId: testUserId,
          year: testYear,
          status: RegistrationStatus.CONFIRMED
        }
      });

      // Add payment
      const payment = await prisma.payment.create({
        data: {
          userId: testUserId,
          registrationId: registration.id,
          amount: 100,
          currency: 'USD',
          status: 'COMPLETED',
          provider: 'STRIPE',
          providerRefId: 'test-payment-id'
        }
      });

      // Cancel registration
      await prisma.registration.update({
        where: { id: registration.id },
        data: { status: RegistrationStatus.CANCELLED }
      });

      // Create new registration
      const newRegistration = await prisma.registration.create({
        data: {
          userId: testUserId,
          year: testYear,
          status: RegistrationStatus.PENDING
        }
      });

      // Verify old payment is still linked to old registration
      const oldPayment = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: { registration: true }
      });

      expect(oldPayment).not.toBeNull();
      expect(oldPayment!.registrationId).toBe(registration.id);
      expect(oldPayment!.registration).not.toBeNull();
      expect(oldPayment!.registration!.status).toBe(RegistrationStatus.CANCELLED);

      // Verify new registration has no payments
      const newRegPayments = await prisma.payment.findMany({
        where: { registrationId: newRegistration.id }
      });

      expect(newRegPayments).toHaveLength(0);
    });

    it('should handle deletion of cancelled registrations correctly', async () => {
      // Create and cancel registration
      const registration = await prisma.registration.create({
        data: {
          userId: testUserId,
          year: testYear,
          status: RegistrationStatus.CANCELLED
        }
      });

      // Create new registration
      const newRegistration = await prisma.registration.create({
        data: {
          userId: testUserId,
          year: testYear,
          status: RegistrationStatus.CONFIRMED
        }
      });

      // Delete cancelled registration
      await prisma.registration.delete({
        where: { id: registration.id }
      });

      // New registration should still exist
      const remaining = await prisma.registration.findUnique({
        where: { id: newRegistration.id }
      });

      expect(remaining).not.toBeNull();
      expect(remaining!.status).toBe(RegistrationStatus.CONFIRMED);
    });
  });

  // Helper functions
  async function setupTestData() {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'migration-test@example.com',
        firstName: 'Migration',
        lastName: 'Test',
        phone: '555-0123',
        password: 'test-hash',
        role: 'PARTICIPANT',
        isEmailVerified: true
      }
    });

    testUserId = testUser.id;

    // Create admin user
    await prisma.user.create({
      data: {
        email: 'migration-admin@example.com',
        firstName: 'Admin',
        lastName: 'Test',
        phone: '555-0124',
        password: 'admin-hash',
        role: 'ADMIN',
        isEmailVerified: true
      }
    });

    // Generate auth tokens (simplified for test)
    userToken = 'test-user-token';
    adminToken = 'test-admin-token';
  }

  async function cleanupTestData() {
    if (testUserId) {
      await prisma.registration.deleteMany({
        where: { userId: testUserId }
      });

      await prisma.payment.deleteMany({
        where: { userId: testUserId }
      });

      await prisma.user.deleteMany({
        where: {
          email: {
            in: ['migration-test@example.com', 'migration-admin@example.com']
          }
        }
      });
    }
  }
}); 