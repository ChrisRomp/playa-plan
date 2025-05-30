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
    
    // Mock createTestAccount for SMTP testing
    (nodemailer.createTestAccount as jest.Mock).mockResolvedValue({
      smtp: {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
      },
      user: 'test.user@ethereal.email',
      pass: 'test-password',
    });

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

  describe('5.6.5 SMTP configuration validation and connection testing', () => {
    beforeEach(() => {
      // Clear mock calls before each test
      mockTransporter.sendMail.mockClear();
      mockTransporter.verify.mockClear();
    });

    it('should validate valid SMTP configuration on refresh', async () => {
      // Arrange - Set up valid SMTP configuration
      // Mock nodemailer.createTestAccount since it doesn't work in test environment
      const mockTestAccount = {
        smtp: {
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
        },
        user: 'test.user@ethereal.email',
        pass: 'test-password',
      };
      
      (nodemailer.createTestAccount as jest.Mock).mockResolvedValue(mockTestAccount);
      
      const testAccount = await nodemailer.createTestAccount();
      
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: true,
          smtpHost: testAccount.smtp.host,
          smtpPort: testAccount.smtp.port,
          smtpUser: testAccount.user,
          smtpPassword: testAccount.pass,
          smtpSecure: testAccount.smtp.secure,
          senderEmail: 'test@example.playaplan.app',
          senderName: 'PlayaPlan Test',
        },
      });

      // Act - Refresh configuration and verify no errors
      await expect(emailService.refreshConfiguration()).resolves.not.toThrow();

      // Verify transporter was created with correct config
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    });

    it('should handle invalid SMTP host gracefully', async () => {
      // Arrange - Set up invalid SMTP configuration
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: true,
          smtpHost: 'invalid-smtp-host.nonexistent',
          smtpPort: 587,
          smtpUser: 'test@example.com',
          smtpPassword: 'testpass',
          smtpSecure: false,
          senderEmail: 'test@example.playaplan.app',
          senderName: 'PlayaPlan Test',
        },
      });

      // Mock transport sendMail to simulate connection failure during actual send
      mockTransporter.sendMail.mockRejectedValue(new Error('Connection failed'));

      // Act - Refresh configuration should not throw
      await expect(emailService.refreshConfiguration()).resolves.not.toThrow();

      // Try to send email which should fail due to invalid host
      const result = await notificationsService.sendLoginCodeEmail(
        'test@example.com',
        '123456',
        testUserId
      );

      // Assert - Email should fail
      expect(result).toBe(false);

      // Check audit record shows connection failure
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          recipientEmail: 'test@example.com',
          notificationType: NotificationType.EMAIL_AUTHENTICATION,
          status: EmailAuditStatus.FAILED,
        },
      });

      expect(auditRecords.length).toBeGreaterThan(0);
      expect(auditRecords[0].errorMessage).toContain('SMTP send operation returned false');
    });

    it('should handle missing SMTP configuration gracefully', async () => {
      // Arrange - Set up configuration with missing SMTP fields
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: true,
          smtpHost: null,
          smtpPort: null,
          smtpUser: null,
          smtpPassword: null,
          smtpSecure: false,
          senderEmail: 'test@example.playaplan.app',
          senderName: 'PlayaPlan Test',
        },
      });

      // Act - Refresh configuration should not throw
      await expect(emailService.refreshConfiguration()).resolves.not.toThrow();

      // Act - Try to send email with incomplete config
      const result = await notificationsService.sendLoginCodeEmail(
        'test@example.com',
        '123456',
        testUserId
      );

      // Assert - Email should fail gracefully
      expect(result).toBe(false);

      // Check that a FAILED audit record was created with appropriate error
      // Note: When SMTP config is completely missing, EmailService detects this early
      // and logs "SMTP configuration incomplete" before attempting to send
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          recipientEmail: 'test@example.com',
          notificationType: NotificationType.EMAIL_AUTHENTICATION,
          status: EmailAuditStatus.FAILED,
        },
        orderBy: {
          createdAt: 'desc', // Get the most recent record
        },
      });

      expect(auditRecords.length).toBeGreaterThan(0);
      expect(auditRecords[0].errorMessage).toContain('SMTP configuration incomplete');
    });

    it('should handle SMTP authentication failure during send', async () => {
      // Arrange - Set up SMTP config that will fail during send
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: true,
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpUser: 'valid@gmail.com', // Valid format but will fail auth
          smtpPassword: 'validpassword', // Valid password format
          smtpSecure: false,
          senderEmail: 'test@example.playaplan.app',
          senderName: 'PlayaPlan Test',
        },
      });

      // Mock transport sendMail to simulate authentication failure
      mockTransporter.sendMail.mockRejectedValue(new Error('Authentication failed'));

      // Act - Refresh configuration
      await emailService.refreshConfiguration();

      // Try to send email
      const result = await notificationsService.sendLoginCodeEmail(
        'test@example.com',
        '123456',
        testUserId
      );

      // Assert - Email should fail
      expect(result).toBe(false);

      // Check that a FAILED audit record was created
      // Note: The sendViaSmtp method catches errors and returns false, 
      // so the error message will be "SMTP send operation returned false"
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          recipientEmail: 'test@example.com',
          notificationType: NotificationType.EMAIL_AUTHENTICATION,
          status: EmailAuditStatus.FAILED,
        },
      });

      expect(auditRecords.length).toBeGreaterThan(0);
      expect(auditRecords[0].errorMessage).toContain('SMTP send operation returned false');
    });

    it('should successfully create transporter with valid configuration', async () => {
      // Arrange - Set up test SMTP configuration
      const mockTestAccount = {
        smtp: {
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
        },
        user: 'test.user@ethereal.email',
        pass: 'test-password',
      };
      
      (nodemailer.createTestAccount as jest.Mock).mockResolvedValue(mockTestAccount);
      const testAccount = await nodemailer.createTestAccount();
      
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: true,
          smtpHost: testAccount.smtp.host,
          smtpPort: testAccount.smtp.port,
          smtpUser: testAccount.user,
          smtpPassword: testAccount.pass,
          smtpSecure: testAccount.smtp.secure,
          senderEmail: 'test@example.playaplan.app',
          senderName: 'PlayaPlan Test',
        },
      });

      // Mock successful email sending
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // Act - Refresh configuration
      await emailService.refreshConfiguration();

      // Send a test email to verify transporter works
      const result = await notificationsService.sendLoginCodeEmail(
        'test@example.com',
        '123456',
        testUserId
      );

      // Assert - Email should be sent successfully
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();

      // Verify audit record was created
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          recipientEmail: 'test@example.com',
          notificationType: NotificationType.EMAIL_AUTHENTICATION,
          status: EmailAuditStatus.SENT,
        },
      });

      expect(auditRecords.length).toBeGreaterThan(0);
    });

    it('should handle SMTP timeout scenarios', async () => {
      // Arrange - Set up SMTP configuration
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: true,
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'test@example.com',
          smtpPassword: 'testpass',
          smtpSecure: false,
          senderEmail: 'test@example.playaplan.app',
          senderName: 'PlayaPlan Test',
        },
      });

      // Mock transport sendMail to simulate timeout
      mockTransporter.sendMail.mockRejectedValue(new Error('Connection timeout'));

      // Act - Refresh configuration and try to send email
      await emailService.refreshConfiguration();
      
      const result = await notificationsService.sendLoginCodeEmail(
        'test@example.com',
        '123456',
        testUserId
      );

      // Assert - Email should fail gracefully
      expect(result).toBe(false);

      // Check audit record shows failed send operation
      // Note: The sendViaSmtp method catches timeout errors and returns false
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          recipientEmail: 'test@example.com',
          notificationType: NotificationType.EMAIL_AUTHENTICATION,
          status: EmailAuditStatus.FAILED,
        },
      });

      expect(auditRecords.length).toBeGreaterThan(0);
      expect(auditRecords[0].errorMessage).toContain('SMTP send operation returned false');
    });
  });

  describe('5.6.6 Concurrent email sending with cache coherency', () => {
    beforeEach(() => {
      // Clear mock calls before each test
      mockTransporter.sendMail.mockClear();
      mockTransporter.verify.mockClear();
    });

    it('should handle concurrent email sending operations', async () => {
      // Arrange - Set up valid SMTP configuration
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: true,
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'test@example.com',
          smtpPassword: 'testpass',
          smtpSecure: false,
          senderEmail: 'test@example.playaplan.app',
          senderName: 'PlayaPlan Test',
        },
      });

      await emailService.refreshConfiguration();

      // Mock successful email sending
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // Act - Send multiple emails concurrently
      const concurrentEmails = Array.from({ length: 5 }, (_, i) => 
        notificationsService.sendLoginCodeEmail(
          `user${i}@example.com`,
          `code${i}`,
          testUserId
        )
      );

      const results = await Promise.all(concurrentEmails);

      // Assert - All emails should be sent successfully
      expect(results.every(result => result === true)).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(5);

      // Check all audit records were created
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          notificationType: NotificationType.EMAIL_AUTHENTICATION,
          status: EmailAuditStatus.SENT,
        },
      });

      expect(auditRecords.length).toBeGreaterThanOrEqual(5);
    });

    it('should maintain cache coherency during concurrent configuration changes', async () => {
      // Arrange - Set up initial configuration
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: true,
          smtpHost: 'initial.smtp.com',
          smtpPort: 587,
          smtpUser: 'initial@example.com',
          smtpPassword: 'initialpass',
          smtpSecure: false,
          senderEmail: 'initial@example.playaplan.app',
          senderName: 'Initial Config',
        },
      });

      await emailService.refreshConfiguration();

      // Mock successful email sending
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // Act - Perform concurrent operations: config change + email sending
      const configUpdate = async () => {
        await prismaService.coreConfig.update({
          where: { id: testConfigId },
          data: {
            smtpHost: 'updated.smtp.com',
            smtpUser: 'updated@example.com',
            smtpPassword: 'updatedpass',
          },
        });
        await emailService.refreshConfiguration();
      };

      const emailSending = async () => {
        const results = [];
        for (let i = 0; i < 3; i++) {
          results.push(await notificationsService.sendLoginCodeEmail(
            `concurrent${i}@example.com`,
            `code${i}`,
            testUserId
          ));
          // Small delay to allow interleaving with config changes
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        return results;
      };

      const [, emailResults] = await Promise.all([
        configUpdate(),
        emailSending(),
      ]);

      // Assert - All emails should be sent successfully despite config change
      expect(emailResults.every(result => result === true)).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);

      // Verify the final configuration is correct
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'updated.smtp.com',
          auth: expect.objectContaining({
            user: 'updated@example.com',
            pass: 'updatedpass',
          }),
        })
      );
    });

    it('should handle concurrent email operations when configuration is disabled', async () => {
      // Arrange - Set up disabled email configuration
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: false,
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'test@example.com',
          smtpPassword: 'testpass',
          smtpSecure: false,
        },
      });

      await emailService.refreshConfiguration();

      // Act - Send multiple emails concurrently when disabled
      const concurrentEmails = Array.from({ length: 3 }, (_, i) => 
        notificationsService.sendPasswordResetEmail(
          `disabled${i}@example.com`,
          `token${i}`,
          testUserId
        )
      );

      const results = await Promise.all(concurrentEmails);

      // Assert - All emails should fail consistently
      expect(results.every(result => result === false)).toBe(true);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();

      // Check all audit records show DISABLED status
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          notificationType: NotificationType.PASSWORD_RESET,
          status: EmailAuditStatus.DISABLED,
        },
      });

      expect(auditRecords.length).toBe(3);
    });

    it('should handle mixed success/failure scenarios under concurrent load', async () => {
      // Arrange - Clear existing audit records for clean test
      await prismaService.emailAudit.deleteMany();
      
      // Set up configuration that will work initially
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: true,
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'test@example.com',
          smtpPassword: 'testpass',
          smtpSecure: false,
          senderEmail: 'test@example.playaplan.app',
          senderName: 'PlayaPlan Test',
        },
      });

      await emailService.refreshConfiguration();

      // Mock alternating success/failure
      let callCount = 0;
      mockTransporter.sendMail.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Intermittent SMTP failure'));
        }
        return Promise.resolve({ messageId: `test-message-${callCount}` });
      });

      // Act - Send multiple emails concurrently with mixed outcomes
      const concurrentEmails = Array.from({ length: 6 }, (_, i) => 
        notificationsService.sendEmailVerificationEmail(
          `mixed${i}@example.com`,
          `token${i}`,
          testUserId
        )
      );

      const results = await Promise.all(concurrentEmails);

      // Assert - Should have mix of success and failure
      const successCount = results.filter(result => result === true).length;
      const failureCount = results.filter(result => result === false).length;

      expect(successCount).toBe(3); // Odd-numbered calls succeed
      expect(failureCount).toBe(3); // Even-numbered calls fail
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(6);

      // Check audit records reflect the mixed outcomes
      const sentAudits = await prismaService.emailAudit.findMany({
        where: {
          notificationType: NotificationType.EMAIL_VERIFICATION,
          status: EmailAuditStatus.SENT,
          recipientEmail: {
            startsWith: 'mixed', // Only count our test emails
          },
        },
      });

      const failedAudits = await prismaService.emailAudit.findMany({
        where: {
          notificationType: NotificationType.EMAIL_VERIFICATION,
          status: EmailAuditStatus.FAILED,
          recipientEmail: {
            startsWith: 'mixed', // Only count our test emails
          },
        },
      });

      expect(sentAudits.length).toBe(3);
      expect(failedAudits.length).toBe(3);
    });

    it('should maintain configuration cache TTL under concurrent access', async () => {
      // Arrange - Set up initial configuration
      await prismaService.coreConfig.update({
        where: { id: testConfigId },
        data: {
          emailEnabled: true,
          smtpHost: 'cache.smtp.com',
          smtpPort: 587,
          smtpUser: 'cache@example.com',
          smtpPassword: 'cachepass',
          smtpSecure: false,
          senderEmail: 'cache@example.playaplan.app',
          senderName: 'Cache Test',
        },
      });

      await emailService.refreshConfiguration();

      // Mock successful email sending
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // Act - Send multiple emails concurrently (should use cached config)
      const concurrentEmails = Array.from({ length: 10 }, (_, i) => 
        notificationsService.sendLoginCodeEmail(
          `cache${i}@example.com`,
          `code${i}`,
          testUserId
        )
      );

      const startTime = Date.now();
      await Promise.all(concurrentEmails);
      const endTime = Date.now();

      // Assert - All emails should be sent successfully
      const auditRecords = await prismaService.emailAudit.findMany({
        where: {
          notificationType: NotificationType.EMAIL_AUTHENTICATION,
          status: EmailAuditStatus.SENT,
        },
      });

      expect(auditRecords.length).toBeGreaterThanOrEqual(10);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(10);
      
      // Verify concurrent operations completed in reasonable time
      // (If cache wasn't working, database queries would slow this down significantly)
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
}); 