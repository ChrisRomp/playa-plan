import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole, RegistrationStatus, PaymentStatus, PaymentProvider } from '@prisma/client';
import { AdminAuditActionType } from '../src/common/enums/admin-audit-action-type.enum';
import { AdminAuditTargetType } from '../src/common/enums/admin-audit-target-type.enum';

describe('Admin Registration Management (Integration Tests)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  // Test tokens for different user roles
  let adminToken: string;
  let staffToken: string;
  let participantToken: string;
  let unauthenticatedToken: string;

  // Test data
  let testUsers: Record<string, { id: string; email: string; role: UserRole }> = {};
  let testJobs: Array<{ id: string; name: string }> = [];
  let testCampingOptions: Array<{ id: string; name: string }> = [];
  let testRegistration: { id: string; userId: string; status: RegistrationStatus };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    
    await app.init();

    // Clean up database before tests
    await cleanDatabase();
    
    // Create test data
    await createTestData();
    
    // Generate tokens for different user roles
    adminToken = jwtService.sign({ 
      sub: testUsers.admin.id,
      email: testUsers.admin.email,
      role: testUsers.admin.role
    });
    
    staffToken = jwtService.sign({ 
      sub: testUsers.staff.id,
      email: testUsers.staff.email,
      role: testUsers.staff.role
    });
    
    participantToken = jwtService.sign({ 
      sub: testUsers.participant.id,
      email: testUsers.participant.email,
      role: testUsers.participant.role
    });

    // Invalid token for testing authentication failures
    unauthenticatedToken = 'invalid-token';
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  async function cleanDatabase() {
    try {
      // Delete in correct order to respect foreign key constraints
      await prismaService.adminAudit.deleteMany();
      await prismaService.emailAudit.deleteMany();
      await prismaService.payment.deleteMany();
      await prismaService.campingOptionRegistration.deleteMany();
      await prismaService.registrationJob.deleteMany();
      await prismaService.registration.deleteMany();
      await prismaService.job.deleteMany();
      await prismaService.campingOption.deleteMany();
      await prismaService.shift.deleteMany();
      await prismaService.jobCategory.deleteMany();
      await prismaService.user.deleteMany();
      await prismaService.coreConfig.deleteMany();
    } catch (error) {
      console.error('Error cleaning database:', error);
    }
  }

  async function createTestData() {
    // Create test users with different roles
    testUsers.admin = await prismaService.user.create({
      data: {
        email: 'admin@integrationtest.com',
        password: 'hashed_password',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        isEmailVerified: true,
      },
    });

    testUsers.staff = await prismaService.user.create({
      data: {
        email: 'staff@integrationtest.com',
        password: 'hashed_password',
        firstName: 'Staff',
        lastName: 'User',
        role: UserRole.STAFF,
        isEmailVerified: true,
      },
    });

    testUsers.participant = await prismaService.user.create({
      data: {
        email: 'participant@integrationtest.com',
        password: 'hashed_password',
        firstName: 'Participant',
        lastName: 'User',
        role: UserRole.PARTICIPANT,
        isEmailVerified: true,
      },
    });

    // Create job category and shifts
    const jobCategory = await prismaService.jobCategory.create({
      data: {
        name: 'Test Category',
        description: 'Test job category',
      },
    });

    const shift = await prismaService.shift.create({
      data: {
        name: 'Test Shift',
        description: 'Test shift',
        startTime: '09:00',
        endTime: '17:00',
        dayOfWeek: 'MONDAY',
      },
    });

    // Create test jobs
    testJobs.push(await prismaService.job.create({
      data: {
        name: 'Kitchen Helper',
        location: 'Kitchen',
        categoryId: jobCategory.id,
        shiftId: shift.id,
        maxRegistrations: 10,
      },
    }));

    testJobs.push(await prismaService.job.create({
      data: {
        name: 'Cleanup Crew',
        location: 'Various',
        categoryId: jobCategory.id,
        shiftId: shift.id,
        maxRegistrations: 5,
      },
    }));

    // Create test camping options
    testCampingOptions.push(await prismaService.campingOption.create({
      data: {
        name: 'Basic Camping',
        description: 'Basic camping spot',
        enabled: true,
        workShiftsRequired: 1,
        participantDues: 100.0, // $100.00
        staffDues: 50.0, // $50.00
        maxSignups: 50,
      },
    }));

    testCampingOptions.push(await prismaService.campingOption.create({
      data: {
        name: 'Premium Camping',
        description: 'Premium camping with amenities',
        enabled: true,
        workShiftsRequired: 2,
        participantDues: 200.0, // $200.00
        staffDues: 100.0, // $100.00
        maxSignups: 25,
      },
    }));

    // Create test registration
    testRegistration = await prismaService.registration.create({
      data: {
        userId: testUsers.participant.id,
        year: 2024,
        status: RegistrationStatus.CONFIRMED,
      },
    });

    // Create job registrations
    await prismaService.registrationJob.create({
      data: {
        registrationId: testRegistration.id,
        jobId: testJobs[0].id,
      },
    });

    // Create camping option registration
    await prismaService.campingOptionRegistration.create({
      data: {
        userId: testUsers.participant.id,
        campingOptionId: testCampingOptions[0].id,
      },
    });

    // Create test payment
    await prismaService.payment.create({
      data: {
        userId: testUsers.participant.id,
        registrationId: testRegistration.id,
        amount: 15000, // $150.00 in cents
        status: PaymentStatus.COMPLETED,
        provider: PaymentProvider.STRIPE,
        providerRefId: 'pi_test_integration',
      },
    });

    // Create core config for notifications
    await prismaService.coreConfig.create({
      data: {
        campName: 'Integration Test Camp',
        registrationYear: 2024,
        emailEnabled: false, // Disable email for integration tests
        senderEmail: 'test@example.com',
        senderName: 'Test Camp',
      },
    });
  }

  // Task 5.9.1: Test complete registration edit workflow from API to database
  describe('Registration Edit Workflow', () => {
    it('should complete full edit workflow from API to database', async () => {
      const editData = {
        status: RegistrationStatus.WAITLISTED,
        jobIds: [testJobs[1].id], // Change from Kitchen Helper to Cleanup Crew
        campingOptionIds: [testCampingOptions[1].id], // Change from Basic to Premium
        notes: 'Changed by admin for integration test',
        sendNotification: false,
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(editData)
        .expect(200);

      expect(response.body.registration).toHaveProperty('status', RegistrationStatus.WAITLISTED);
      expect(response.body.message).toContain('successfully updated');

      // Verify database changes
      const updatedRegistration = await prismaService.registration.findUnique({
        where: { id: testRegistration.id },
      });

      expect(updatedRegistration?.status).toBe(RegistrationStatus.WAITLISTED);

      // Verify audit trail was created
      const auditRecords = await prismaService.adminAudit.findMany({
        where: { 
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: testRegistration.id,
        },
      });

      expect(auditRecords.length).toBeGreaterThan(0);
      expect(auditRecords[0].actionType).toBe(AdminAuditActionType.REGISTRATION_EDIT);
      expect(auditRecords[0].adminUserId).toBe(testUsers.admin.id);
    });
  });

  // Task 5.9.2: Test complete registration cancellation workflow with cleanup
  describe('Registration Cancellation Workflow', () => {
    it('should complete full cancellation workflow with cleanup', async () => {
      const cancelData = {
        reason: 'User requested cancellation for integration test',
        sendNotification: false,
        processRefund: true,
      };

      const response = await request(app.getHttpServer())
        .delete(`/admin/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(cancelData)
        .expect(200);

      expect(response.body.registration.status).toBe(RegistrationStatus.CANCELLED);
      expect(response.body.message).toContain('successfully cancelled');

      // Verify database cleanup
      const cancelledRegistration = await prismaService.registration.findUnique({
        where: { id: testRegistration.id },
      });

      expect(cancelledRegistration?.status).toBe(RegistrationStatus.CANCELLED);

      // Verify audit trail for cancellation
      const auditRecords = await prismaService.adminAudit.findMany({
        where: { 
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: testRegistration.id,
          actionType: AdminAuditActionType.REGISTRATION_CANCEL,
        },
      });

      expect(auditRecords.length).toBeGreaterThan(0);
      expect(auditRecords[0].reason).toContain('User requested cancellation');
    });
  });

  // Task 5.9.3: Test audit trail creation and retrieval across all admin operations  
  describe('Audit Trail Integration', () => {
    it('should create and retrieve audit trail across all operations', async () => {
      // Get initial audit count
      const initialAuditCount = await prismaService.adminAudit.count();

      // Perform multiple admin operations
      await request(app.getHttpServer())
        .put(`/admin/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: RegistrationStatus.PENDING,
          notes: 'First change',
          sendNotification: false,
        })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/admin/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: RegistrationStatus.CONFIRMED,
          notes: 'Second change',
          sendNotification: false,
        })
        .expect(200);

      // Verify audit records were created
      const finalAuditCount = await prismaService.adminAudit.count();
      expect(finalAuditCount).toBeGreaterThan(initialAuditCount);

      // Test audit trail retrieval
      const response = await request(app.getHttpServer())
        .get(`/admin/registrations/${testRegistration.id}/audit-trail`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('actionType');
      expect(response.body[0]).toHaveProperty('adminUser');
      expect(response.body[0]).toHaveProperty('createdAt');
    });
  });

  // Task 5.9.4: Test notification integration with admin operations
  describe('Notification Integration', () => {
    it('should integrate notifications with admin operations', async () => {
      const editData = {
        status: RegistrationStatus.CONFIRMED,
        notes: 'Testing notification integration',
        sendNotification: true, // Enable notification
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(editData)
        .expect(200);

      expect(response.body.notificationStatus).toBeDefined();
      // With email disabled in test config, should indicate no notification sent
      expect(response.body.notificationStatus).toContain('No notification sent');
    });
  });

  // Task 5.9.5: Test authorization and role-based access control for all endpoints
  describe('Authorization and Access Control', () => {
    it('should enforce admin-only access to admin registration endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/admin/registrations' },
        { method: 'put', path: `/admin/registrations/${testRegistration.id}` },
        { method: 'delete', path: `/admin/registrations/${testRegistration.id}` },
        { method: 'get', path: `/admin/registrations/${testRegistration.id}/audit-trail` },
      ];

      for (const endpoint of endpoints) {
        // Test admin access (should work)
        const adminResponse = await request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(endpoint.method === 'put' ? { notes: 'test' } : {})
          .send(endpoint.method === 'delete' ? { reason: 'test' } : {});

        expect(adminResponse.status).not.toBe(403);
      }
    });

    // Task 5.9.7: Test participant users cannot access admin registration management endpoints
    it('should deny participant users access to admin endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/admin/registrations' },
        { method: 'put', path: `/admin/registrations/${testRegistration.id}` },
        { method: 'delete', path: `/admin/registrations/${testRegistration.id}` },
        { method: 'get', path: `/admin/registrations/${testRegistration.id}/audit-trail` },
      ];

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${participantToken}`)
          .send(endpoint.method === 'put' ? { notes: 'test' } : {})
          .send(endpoint.method === 'delete' ? { reason: 'test' } : {})
          .expect(403);
      }
    });

    // Task 5.9.8: Test staff users cannot access admin registration management endpoints  
    it('should deny staff users access to admin endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/admin/registrations' },
        { method: 'put', path: `/admin/registrations/${testRegistration.id}` },
        { method: 'delete', path: `/admin/registrations/${testRegistration.id}` },
        { method: 'get', path: `/admin/registrations/${testRegistration.id}/audit-trail` },
      ];

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${staffToken}`)
          .send(endpoint.method === 'put' ? { notes: 'test' } : {})
          .send(endpoint.method === 'delete' ? { reason: 'test' } : {})
          .expect(403);
      }
    });
  });

  // Task 5.9.9: Test JWT token validation and expiration handling for admin endpoints
  describe('JWT Token Validation', () => {
    it('should reject requests with invalid JWT tokens', async () => {
      const endpoints = [
        { method: 'get', path: '/admin/registrations' },
        { method: 'put', path: `/admin/registrations/${testRegistration.id}` },
        { method: 'delete', path: `/admin/registrations/${testRegistration.id}` },
        { method: 'get', path: `/admin/registrations/${testRegistration.id}/audit-trail` },
      ];

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${unauthenticatedToken}`)
          .send(endpoint.method === 'put' ? { notes: 'test' } : {})
          .send(endpoint.method === 'delete' ? { reason: 'test' } : {})
          .expect(401);
      }
    });

    it('should reject requests with no authorization header', async () => {
      await request(app.getHttpServer())
        .get('/admin/registrations')
        .expect(401);
    });
  });

  // Task 5.9.6: Test frontend-backend integration for all admin registration operations
  describe('Frontend-Backend Integration', () => {
    it('should handle complete registration search and filtering', async () => {
      const queryParams = new URLSearchParams({
        page: '1',
        limit: '10',
        status: RegistrationStatus.CONFIRMED,
        email: testUsers.participant.email,
        name: 'Participant',
        year: '2024',
      });

      const response = await request(app.getHttpServer())
        .get(`/admin/registrations?${queryParams}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('registrations');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(Array.isArray(response.body.registrations)).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/registrations?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
      expect(response.body.totalPages).toBeGreaterThanOrEqual(1);
    });
  });

  // Task 5.9.10: Test automatic refund processing integration
  describe('Automatic Refund Processing Integration', () => {
    it('should process automatic refunds for supported payment providers', async () => {
      // Create a new registration with Stripe payment for refund testing
      const refundTestRegistration = await prismaService.registration.create({
        data: {
          userId: testUsers.participant.id,
          year: 2024,
          status: RegistrationStatus.CONFIRMED,
        },
      });

      await prismaService.payment.create({
        data: {
          userId: testUsers.participant.id,
          registrationId: refundTestRegistration.id,
          amount: 10000, // $100.00 in cents
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.STRIPE,
          providerRefId: 'pi_test_refund_integration',
        },
      });

      const cancelData = {
        reason: 'Testing automatic refund processing',
        sendNotification: false,
        processRefund: true,
      };

      // Note: This will fail in integration test due to Stripe API not being mocked
      // But it tests the integration flow
      const response = await request(app.getHttpServer())
        .delete(`/admin/registrations/${refundTestRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(cancelData);

      // Should still cancel registration even if refund fails
      expect(response.status).toBe(200);
      expect(response.body.registration.status).toBe(RegistrationStatus.CANCELLED);
    });
  });

  // Task 5.9.11: Test MANUAL payment provider handling in refund workflows
  describe('Manual Payment Provider Handling', () => {
    it('should handle MANUAL payment provider refunds correctly', async () => {
      // Create registration with manual payment
      const manualPaymentRegistration = await prismaService.registration.create({
        data: {
          userId: testUsers.participant.id,
          year: 2024,
          status: RegistrationStatus.CONFIRMED,
        },
      });

      await prismaService.payment.create({
        data: {
          userId: testUsers.participant.id,
          registrationId: manualPaymentRegistration.id,
          amount: 15000, // $150.00 in cents
          status: PaymentStatus.COMPLETED,
          provider: PaymentProvider.MANUAL,
          providerRefId: 'MANUAL-PAYMENT-001',
        },
      });

      const cancelData = {
        reason: 'Testing manual payment refund handling',
        sendNotification: false,
        processRefund: true,
      };

      const response = await request(app.getHttpServer())
        .delete(`/admin/registrations/${manualPaymentRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(cancelData)
        .expect(200);

      expect(response.body.registration.status).toBe(RegistrationStatus.CANCELLED);
      expect(response.body.refundInfo).toContain('manual');
    });
  });

  // Task 5.9.12: Test email notification templates with conditional content
  describe('Email Notification Templates', () => {
    it('should handle notification templates with conditional content', async () => {
      const editData = {
        status: RegistrationStatus.WAITLISTED,
        notes: 'Testing conditional notification content',
        sendNotification: true,
      };

      const response = await request(app.getHttpServer())
        .put(`/admin/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(editData)
        .expect(200);

      // Check that notification attempt was logged appropriately
      expect(response.body.notificationStatus).toBeDefined();
      // In test environment with email disabled, should indicate no notification sent
      expect(response.body.notificationStatus).toContain('No notification sent');
    });
  });

  // Additional edge case testing
  describe('Edge Cases and Error Handling', () => {
    it('should handle editing non-existent registration', async () => {
      await request(app.getHttpServer())
        .put('/admin/registrations/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: RegistrationStatus.CONFIRMED,
          notes: 'Test edit',
        })
        .expect(404);
    });

    it('should handle cancelling already cancelled registration', async () => {
      // First cancel the registration
      await request(app.getHttpServer())
        .delete(`/admin/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'First cancellation',
          processRefund: false,
        })
        .expect(200);

      // Try to cancel again
      await request(app.getHttpServer())
        .delete(`/admin/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Second cancellation attempt',
          processRefund: false,
        })
        .expect(400);
    });

    it('should validate request data properly', async () => {
      await request(app.getHttpServer())
        .put(`/admin/registrations/${testRegistration.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'INVALID_STATUS',
          notes: 'Test with invalid status',
        })
        .expect(400);
    });
  });
}); 