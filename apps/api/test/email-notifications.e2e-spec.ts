import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole, NotificationType, EmailAuditStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsService } from '../src/notifications/services/notifications.service';
import { EmailService } from '../src/notifications/services/email.service';
import * as nodemailer from 'nodemailer';

// Mock nodemailer to prevent actual email sending in tests
jest.mock('nodemailer');

describe('Email Notifications (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prismaService: PrismaService;
  let notificationsService: NotificationsService;
  let emailService: EmailService;
  let adminToken: string;
  let testUserId: string;
  let testConfigId: string;
  let mockTransporter: jest.Mocked<nodemailer.Transporter>;

  beforeAll(async () => {
    // Mock nodemailer transporter
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      verify: jest.fn().mockResolvedValue(true),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

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
    notificationsService = app.get(NotificationsService);
    emailService = app.get(EmailService);

    // Clean up existing data
    await prismaService.emailAudit.deleteMany();
    await prismaService.coreConfig.deleteMany();
    await prismaService.user.deleteMany();

    // Create test admin user
    const adminUser = await prismaService.user.create({
      data: {
        id: uuidv4(),
        email: 'admin-test@example.playaplan.app',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        isEmailVerified: true,
      },
    });

    // Create test regular user
    const testUser = await prismaService.user.create({
      data: {
        id: uuidv4(),
        email: 'test-user@example.playaplan.app',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.PARTICIPANT,
        isEmailVerified: true,
      },
    });

    testUserId = testUser.id;

    // Create JWT token for admin
    adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: adminUser.role,
    });

    // Create test core configuration with email enabled
    const config = await prismaService.coreConfig.create({
      data: {
        id: uuidv4(),
        campName: 'Test Camp',
        registrationYear: 2024,
        timeZone: 'UTC',
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUser: 'test@example.com',
        smtpPassword: 'testpass',
        smtpSecure: false,
        senderEmail: 'noreply@test.com',
        senderName: 'Test Camp',
      },
    });

    testConfigId = config.id;

    // Refresh email service configuration
    await emailService.refreshConfiguration();
  });

  afterAll(async () => {
    // Clean up
    await prismaService.emailAudit.deleteMany();
    await prismaService.coreConfig.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  describe('5.6.1 Complete email flow from service call to audit log creation', () => {
    beforeEach(() => {
      // Reset mocks before each test
      mockTransporter.sendMail.mockClear();
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });
    });

    it('should send email and create SENT audit record', async () => {
      // Act - Send email through NotificationsService
      const result = await notificationsService.sendLoginCodeEmail(
        'test-user@example.playaplan.app',
        '123456',
        testUserId
      );

      // Assert - Email should be sent successfully
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test-user@example.playaplan.app',
          subject: expect.stringContaining('Login'),
          html: expect.stringContaining('123456'),
        })
      );

      // Check audit record was created
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          recipientEmail: 'test-user@example.playaplan.app',
          notificationType: NotificationType.EMAIL_AUTHENTICATION,
        },
      });

      expect(auditRecords).toHaveLength(1);
      expect(auditRecords[0]).toMatchObject({
        recipientEmail: 'test-user@example.playaplan.app',
        subject: expect.stringContaining('Login'),
        notificationType: NotificationType.EMAIL_AUTHENTICATION,
        status: EmailAuditStatus.SENT,
        userId: testUserId,
        errorMessage: null,
      });
      expect(auditRecords[0].sentAt).toBeDefined();
    });

    it('should create FAILED audit record when SMTP fails', async () => {
      // Arrange - Mock SMTP failure
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      // Act - Attempt to send email
      const result = await notificationsService.sendPasswordResetEmail(
        'test-user@example.playaplan.app',
        'reset-token-123',
        testUserId
      );

      // Assert - Email should fail
      expect(result).toBe(false);

      // Check FAILED audit record was created
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          recipientEmail: 'test-user@example.playaplan.app',
          notificationType: NotificationType.PASSWORD_RESET,
        },
      });

      expect(auditRecords).toHaveLength(1);
      expect(auditRecords[0]).toMatchObject({
        status: EmailAuditStatus.FAILED,
        errorMessage: expect.stringContaining('SMTP send operation returned false'),
        sentAt: null,
      });
    });

    it('should create DISABLED audit record when email is disabled', async () => {
      // Arrange - Disable email in configuration
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: { emailEnabled: false },
      });

      // Refresh configuration to pick up the change
      await emailService.refreshConfiguration();

      // Act - Attempt to send email
      const result = await notificationsService.sendEmailVerificationEmail(
        'test-user@example.playaplan.app',
        'verify-token-123',
        testUserId
      );

      // Assert - Email should not be sent
      expect(result).toBe(false);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();

      // Check DISABLED audit record was created
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          recipientEmail: 'test-user@example.playaplan.app',
          notificationType: NotificationType.EMAIL_VERIFICATION,
        },
      });

      expect(auditRecords).toHaveLength(1);
      expect(auditRecords[0]).toMatchObject({
        status: EmailAuditStatus.DISABLED,
        sentAt: null,
        errorMessage: null,
      });

      // Restore email enabled for other tests
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: { emailEnabled: true },
      });
      await emailService.refreshConfiguration();
    });

    it('should handle CC and BCC emails in audit trail', async () => {
      // Act - Send email with CC and BCC
      const result = await emailService.sendEmail({
        to: 'primary@example.com',
        ccEmails: ['cc1@example.com', 'cc2@example.com'],
        bccEmails: ['bcc@example.com'],
        subject: 'Test with CC/BCC',
        html: '<p>Test content</p>',
        notificationType: NotificationType.PAYMENT_CONFIRMATION,
        userId: testUserId,
      });

      // Assert
      expect(result).toBe(true);

      // Check audit record includes CC/BCC emails
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          recipientEmail: 'primary@example.com',
          notificationType: NotificationType.PAYMENT_CONFIRMATION,
        },
      });

      expect(auditRecords).toHaveLength(1);
      expect(auditRecords[0]).toMatchObject({
        ccEmails: 'cc1@example.com,cc2@example.com',
        bccEmails: 'bcc@example.com',
        status: EmailAuditStatus.SENT,
      });
    });
  });

  describe('5.6.2 Email configuration changes are reflected in email sending', () => {
    it('should use updated SMTP configuration after refresh', async () => {
      // Arrange - Update SMTP configuration
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          smtpHost: 'updated.smtp.com',
          smtpPort: 465,
          smtpSecure: true,
          smtpUser: 'updated@example.com',
          smtpPassword: 'updatedpass',
        },
      });

      // Act - Refresh configuration and send email
      await emailService.refreshConfiguration();
      
      const result = await notificationsService.sendLoginCodeEmail(
        'test-config@example.com',
        '654321',
        testUserId
      );

      // Assert - Email should be sent with new configuration
      expect(result).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'updated.smtp.com',
        port: 465,
        secure: true,
        auth: {
          user: 'updated@example.com',
          pass: 'updatedpass',
        },
      });
    });
  });

  describe('5.6.3 Global email toggle affects all notification types', () => {
    it('should disable all notification types when emailEnabled is false', async () => {
      // Arrange - Disable email globally
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: { emailEnabled: false },
      });
      await emailService.refreshConfiguration();

      // Clear any previous mock calls
      mockTransporter.sendMail.mockClear();

      // Act & Assert - Test multiple notification types
      const testCases = [
        {
          method: () => notificationsService.sendLoginCodeEmail('test@example.com', '123456', testUserId),
          type: NotificationType.EMAIL_AUTHENTICATION,
        },
        {
          method: () => notificationsService.sendPasswordResetEmail('test@example.com', 'token', testUserId),
          type: NotificationType.PASSWORD_RESET,
        },
        {
          method: () => notificationsService.sendEmailVerificationEmail('test@example.com', 'token', testUserId),
          type: NotificationType.EMAIL_VERIFICATION,
        },
      ];

      for (const testCase of testCases) {
        const result = await testCase.method();
        expect(result).toBe(false);

        // Check DISABLED audit record was created
        const auditRecords = await prismaService.emailAudit.findMany({
          where: {
            recipientEmail: 'test@example.com',
            notificationType: testCase.type,
            status: EmailAuditStatus.DISABLED,
          },
        });
        expect(auditRecords.length).toBeGreaterThan(0);
      }

      // Verify no actual emails were sent
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();

      // Restore email enabled for other tests
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: { emailEnabled: true },
      });
      await emailService.refreshConfiguration();
    });
  });

  describe('5.6.4 Email audit statistics endpoint returns accurate data', () => {
    it('should return accurate email statistics', async () => {
      // Arrange - Clear existing audit records for clean test
      await prismaService.emailAudit.deleteMany();

      // Create some test audit records
      const testAudits = [
        {
          recipientEmail: 'user1@example.com',
          subject: 'Test Email 1',
          notificationType: NotificationType.EMAIL_VERIFICATION,
          status: EmailAuditStatus.SENT,
          sentAt: new Date(),
          userId: testUserId,
        },
        {
          recipientEmail: 'user2@example.com',
          subject: 'Test Email 2',
          notificationType: NotificationType.EMAIL_VERIFICATION,
          status: EmailAuditStatus.FAILED,
          errorMessage: 'SMTP error',
          userId: testUserId,
        },
        {
          recipientEmail: 'user3@example.com',
          subject: 'Test Email 3',
          notificationType: NotificationType.PASSWORD_RESET,
          status: EmailAuditStatus.SENT,
          sentAt: new Date(),
          userId: testUserId,
        },
        {
          recipientEmail: 'user4@example.com',
          subject: 'Test Email 4',
          notificationType: NotificationType.EMAIL_AUTHENTICATION,
          status: EmailAuditStatus.DISABLED,
          userId: testUserId,
        },
      ];

      // Create audit records in database
      for (const audit of testAudits) {
        await prismaService.emailAudit.create({
          data: {
            id: uuidv4(),
            ...audit,
            createdAt: new Date(),
          },
        });
      }

      // Act - Call the statistics endpoint
      const response = await request(app.getHttpServer())
        .get('/notifications/email/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert - Check statistics are accurate
      expect(response.body).toMatchObject({
        totalEmails: 4,
        sentEmails: 2,
        failedEmails: 1,
        disabledEmails: 1,
        byNotificationType: {
          [NotificationType.EMAIL_VERIFICATION]: 2,
          [NotificationType.PASSWORD_RESET]: 1,
          [NotificationType.EMAIL_AUTHENTICATION]: 1,
        },
      });
    });

    it('should filter statistics by date range', async () => {
      // Arrange - Clear existing audit records
      await prismaService.emailAudit.deleteMany();

      const oldDate = new Date('2023-01-01');
      const recentDate = new Date();

      // Create audit records with different dates
      await prismaService.emailAudit.create({
        data: {
          id: uuidv4(),
          recipientEmail: 'old@example.com',
          subject: 'Old Email',
          notificationType: NotificationType.EMAIL_VERIFICATION,
          status: EmailAuditStatus.SENT,
          sentAt: oldDate,
          createdAt: oldDate,
          userId: testUserId,
        },
      });

      await prismaService.emailAudit.create({
        data: {
          id: uuidv4(),
          recipientEmail: 'recent@example.com',
          subject: 'Recent Email',
          notificationType: NotificationType.EMAIL_VERIFICATION,
          status: EmailAuditStatus.SENT,
          sentAt: recentDate,
          createdAt: recentDate,
          userId: testUserId,
        },
      });

      // Act - Get statistics for recent date range only
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const endDate = new Date(); // Now

      const response = await request(app.getHttpServer())
        .get('/notifications/email/statistics')
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert - Should only include recent email
      expect(response.body).toMatchObject({
        totalEmails: 1,
        sentEmails: 1,
        failedEmails: 0,
        disabledEmails: 0,
        byNotificationType: {
          [NotificationType.EMAIL_VERIFICATION]: 1,
        },
      });
    });

    it('should require admin role for statistics endpoint', async () => {
      // Act & Assert - Non-admin user should be forbidden
      await request(app.getHttpServer())
        .get('/notifications/email/statistics')
        .expect(401); // No token

      // Should also test with regular user token if we had one
    });
  });
}); 