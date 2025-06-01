import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../services/notifications.service';
import { EmailService } from '../services/email.service';
import { EmailAuditService } from '../services/email-audit.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SendEmailDto, SendEmailToMultipleRecipientsDto } from '../dto/send-email.dto';
import { NotificationType, UserRole, EmailAuditStatus } from '@prisma/client';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const mockNotificationsService = {
    sendEmailVerificationEmail: jest.fn(),
    sendTestEmail: jest.fn(),
  };

  const mockEmailService = {
    sendEmail: jest.fn(),
    testSmtpConnection: jest.fn(),
  };

  const mockEmailAuditService = {
    getEmailStatistics: jest.fn(),
  };

  const mockCoreConfigService = {
    getEmailConfiguration: jest.fn(),
    findCurrent: jest.fn().mockResolvedValue({
      campName: 'Test Camp',
    }),
  };

  const mockPrismaService = {
    emailAudit: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: EmailAuditService,
          useValue: mockEmailAuditService,
        },
        {
          provide: CoreConfigService,
          useValue: mockCoreConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should send an email', async () => {
      const dto: SendEmailDto = {
        to: 'test@example.playaplan.app',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      };

      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await controller.sendEmail(dto);

      expect(result).toEqual({ success: true });
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.playaplan.app',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: undefined,
        notificationType: NotificationType.EMAIL_VERIFICATION,
        attachments: undefined,
      });
    });

    it('should return success: false when email fails', async () => {
      const dto: SendEmailDto = {
        to: 'test@example.playaplan.app',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      };

      mockEmailService.sendEmail.mockResolvedValueOnce(false);

      const result = await controller.sendEmail(dto);

      expect(result).toEqual({ success: false });
    });
  });

  describe('sendEmailToMultipleRecipients', () => {
    it('should send an email to multiple recipients', async () => {
      const dto: SendEmailToMultipleRecipientsDto = {
        to: ['test1@example.playaplan.app', 'test2@example.playaplan.app'],
        subject: 'Batch Email',
        html: '<p>Batch content</p>',
      };

      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await controller.sendEmailToMultipleRecipients(dto);

      expect(result).toEqual({ success: true });
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: ['test1@example.playaplan.app', 'test2@example.playaplan.app'],
        subject: 'Batch Email',
        html: '<p>Batch content</p>',
        text: undefined,
        notificationType: NotificationType.EMAIL_VERIFICATION,
        attachments: undefined,
      });
    });
  });

  describe('sendTestEmail', () => {
    it('should send a test email successfully', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: 'user-123',
          email: 'admin@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.ADMIN,
        },
      };

      const mockEmailConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'test@example.playaplan.app',
        senderName: 'PlayaPlan Test',
      };

      const mockAuditRecord = {
        id: 'audit-123',
        recipientEmail: 'test@example.playaplan.app',
        notificationType: NotificationType.EMAIL_TEST,
        status: 'SENT',
        createdAt: new Date(),
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);
      mockNotificationsService.sendTestEmail.mockResolvedValue(true);
      mockPrismaService.emailAudit.findMany.mockResolvedValue([mockAuditRecord]);

      // Act
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await controller.sendTestEmail({ email: 'test@example.playaplan.app' }, mockRequest as any);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Test email sent successfully');
      expect(result.smtpConfiguration).toEqual({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        senderEmail: 'test@example.playaplan.app',
        senderName: 'PlayaPlan Test',
      });
      expect(mockNotificationsService.sendTestEmail).toHaveBeenCalledWith(
        'test@example.playaplan.app',
        expect.objectContaining({
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpSecure: false,
          senderEmail: 'test@example.playaplan.app',
          senderName: 'PlayaPlan Test',
          adminUserName: 'John Doe',
          adminEmail: 'admin@example.com',
          timestamp: expect.any(Date),
        }),
        'user-123',
        {
          subject: 'Test Email from Test Camp',
          message: undefined,
          format: undefined,
          includeSmtpDetails: undefined,
        }
      );
    });

    it('should return error when email is disabled', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: 'user-123',
          email: 'admin@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.ADMIN,
        },
      };

      const mockEmailConfig = {
        emailEnabled: false,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'test@example.playaplan.app',
        senderName: 'PlayaPlan Test',
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);

      // Act
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await controller.sendTestEmail({ email: 'test@example.playaplan.app' }, mockRequest as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Email notifications are currently disabled');
      expect(mockNotificationsService.sendTestEmail).not.toHaveBeenCalled();
    });
  });

  describe('getEmailStatistics', () => {
    it('should return email statistics', async () => {
      const mockStats = {
        totalEmails: 100,
        sentEmails: 80,
        failedEmails: 15,
        disabledEmails: 5,
        byNotificationType: {
          [NotificationType.EMAIL_VERIFICATION]: 50,
          [NotificationType.PASSWORD_RESET]: 30,
          [NotificationType.EMAIL_AUTHENTICATION]: 20,
        },
      };

      mockEmailAuditService.getEmailStatistics.mockResolvedValueOnce(mockStats);

      const result = await controller.getEmailStatistics();

      expect(result).toEqual(mockStats);
      expect(mockEmailAuditService.getEmailStatistics).toHaveBeenCalledWith(
        expect.any(Date), // start date
        expect.any(Date), // end date
      );
    });

    it('should accept custom date range', async () => {
      const mockStats = {
        totalEmails: 50,
        sentEmails: 45,
        failedEmails: 3,
        disabledEmails: 2,
        byNotificationType: {
          [NotificationType.EMAIL_VERIFICATION]: 25,
          [NotificationType.PASSWORD_RESET]: 25,
        },
      };

      mockEmailAuditService.getEmailStatistics.mockResolvedValueOnce(mockStats);

      const startDate = '2023-01-01T00:00:00.000Z';
      const endDate = '2023-01-31T23:59:59.999Z';

      const result = await controller.getEmailStatistics(startDate, endDate);

      expect(result).toEqual(mockStats);
      expect(mockEmailAuditService.getEmailStatistics).toHaveBeenCalledWith(
        new Date(startDate),
        new Date(endDate),
      );
    });
  });

  describe('getTestEmailHistory', () => {
    it('should return test email history with default limit', async () => {
      const mockHistory = [
        {
          id: 'test-1',
          recipientEmail: 'test1@example.com',
          subject: 'Test Email 1',
          status: EmailAuditStatus.SENT,
          errorMessage: null,
          sentAt: new Date('2023-12-01T10:00:00Z'),
          createdAt: new Date('2023-12-01T10:00:00Z'),
          userId: 'user-1',
        },
        {
          id: 'test-2',
          recipientEmail: 'test2@example.com',
          subject: 'Test Email 2',
          status: EmailAuditStatus.FAILED,
          errorMessage: 'SMTP error',
          sentAt: null,
          createdAt: new Date('2023-12-01T09:00:00Z'),
          userId: 'user-1',
        },
      ];

      mockPrismaService.emailAudit.findMany.mockResolvedValueOnce(mockHistory);
      mockPrismaService.emailAudit.count.mockResolvedValueOnce(2);

      const result = await controller.getTestEmailHistory();

      expect(result).toEqual({
        testEmails: [
          {
            id: 'test-1',
            recipientEmail: 'test1@example.com',
            subject: 'Test Email 1',
            status: 'SENT',
            errorMessage: undefined,
            sentAt: '2023-12-01T10:00:00.000Z',
            createdAt: '2023-12-01T10:00:00.000Z',
            userId: 'user-1',
          },
          {
            id: 'test-2',
            recipientEmail: 'test2@example.com',
            subject: 'Test Email 2',
            status: 'FAILED',
            errorMessage: 'SMTP error',
            sentAt: undefined,
            createdAt: '2023-12-01T09:00:00.000Z',
            userId: 'user-1',
          },
        ],
        total: 2,
      });

      expect(mockPrismaService.emailAudit.findMany).toHaveBeenCalledWith({
        where: { notificationType: NotificationType.EMAIL_TEST },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          recipientEmail: true,
          subject: true,
          status: true,
          errorMessage: true,
          sentAt: true,
          createdAt: true,
          userId: true,
        },
      });
    });

    it('should return test email history with custom limit', async () => {
      mockPrismaService.emailAudit.findMany.mockResolvedValueOnce([]);
      mockPrismaService.emailAudit.count.mockResolvedValueOnce(0);

      const result = await controller.getTestEmailHistory('25');

      expect(result).toEqual({
        testEmails: [],
        total: 0,
      });

      expect(mockPrismaService.emailAudit.findMany).toHaveBeenCalledWith({
        where: { notificationType: NotificationType.EMAIL_TEST },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          recipientEmail: true,
          subject: true,
          status: true,
          errorMessage: true,
          sentAt: true,
          createdAt: true,
          userId: true,
        },
      });
    });

    it('should enforce maximum limit of 50', async () => {
      mockPrismaService.emailAudit.findMany.mockResolvedValueOnce([]);
      mockPrismaService.emailAudit.count.mockResolvedValueOnce(0);

      await controller.getTestEmailHistory('100');

      expect(mockPrismaService.emailAudit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50, // Should be capped at 50
        }),
      );
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.emailAudit.findMany.mockRejectedValueOnce(new Error('Database error'));

      await expect(controller.getTestEmailHistory()).rejects.toThrow(
        'Failed to retrieve test email history: Database error'
      );
    });
  });

  describe('testSmtpConnection', () => {
    it('should test SMTP connection successfully', async () => {
      const mockEmailConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'test@example.playaplan.app',
        senderName: 'PlayaPlan Test',
      };

      const mockConnectionResult = {
        success: true,
        message: 'SMTP connection verified successfully',
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);
      mockEmailService.testSmtpConnection.mockResolvedValue(mockConnectionResult);

      const result = await controller.testSmtpConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('SMTP connection successful');
      expect(result.details).toEqual({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        authenticated: true,
        connectionTime: expect.any(Number),
      });
    });

    it('should return error when email is disabled', async () => {
      const mockEmailConfig = {
        emailEnabled: false,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'test@example.playaplan.app',
        senderName: 'PlayaPlan Test',
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);

      const result = await controller.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Email notifications are currently disabled');
      expect(mockEmailService.testSmtpConnection).not.toHaveBeenCalled();
    });

    it('should return error when SMTP configuration is incomplete', async () => {
      const mockEmailConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        smtpUseSsl: false,
        senderEmail: '',
        senderName: 'PlayaPlan Test',
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);

      const result = await controller.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('SMTP configuration is incomplete');
      expect(result.details).toEqual({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        authenticated: false,
      });
      expect(mockEmailService.testSmtpConnection).not.toHaveBeenCalled();
    });

    it('should handle SMTP connection failure with detailed error information', async () => {
      const mockEmailConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'test@example.playaplan.app',
        senderName: 'PlayaPlan Test',
      };

      const mockConnectionResult = {
        success: false,
        message: 'Connection refused. Check SMTP host and port.',
        errorDetails: {
          code: 'ECONNREFUSED',
          errno: -111,
          address: '192.168.1.1',
          port: 587,
        },
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);
      mockEmailService.testSmtpConnection.mockResolvedValue(mockConnectionResult);

      const result = await controller.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
      expect(result.errorDetails).toEqual({
        code: 'ECONNREFUSED',
        errno: -111,
        address: '192.168.1.1',
        port: 587,
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      mockCoreConfigService.getEmailConfiguration.mockRejectedValue(new Error('Database connection failed'));

      const result = await controller.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error testing SMTP connection');
    });

    it('should use form configuration when provided in DTO', async () => {
      const mockDbConfig = {
        emailEnabled: false,
        smtpHost: 'old-smtp.test.com',
        smtpPort: 25,
        smtpUsername: 'old@example.com',
        smtpPassword: 'oldpassword',
        smtpUseSsl: true,
        senderEmail: 'old-sender@example.com',
        senderName: 'Old Sender',
      };

      const mockFormConfig = {
        emailEnabled: true,
        smtpHost: 'form-smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'form@example.com',
        smtpPassword: 'formpassword',
        smtpUseSsl: false,
        senderEmail: 'form-sender@example.com',
        senderName: 'Form Sender',
      };

      const mockConnectionResult = {
        success: true,
        message: 'SMTP connection verified successfully',
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockDbConfig);
      mockEmailService.testSmtpConnection.mockResolvedValue(mockConnectionResult);

      const result = await controller.testSmtpConnection(mockFormConfig);

      expect(result.success).toBe(true);
      expect(result.details?.host).toBe('form-smtp.test.com');
      expect(result.details?.port).toBe(587);
      expect(result.details?.secure).toBe(false);
      
      // Verify that EmailService was called with the form config
      expect(mockEmailService.testSmtpConnection).toHaveBeenCalledWith(mockFormConfig);
    });

    it('should merge partial form configuration with database configuration', async () => {
      const mockDbConfig = {
        emailEnabled: false,
        smtpHost: 'old-smtp.test.com',
        smtpPort: 25,
        smtpUsername: 'old@example.com',
        smtpPassword: 'oldpassword',
        smtpUseSsl: true,
        senderEmail: 'old-sender@example.com',
        senderName: 'Old Sender',
      };

      const mockFormConfig = {
        emailEnabled: true,
        smtpHost: 'form-smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'form@example.com',
        smtpUseSsl: false,
        senderEmail: 'form-sender@example.com',
        senderName: 'Form Sender',
        // Note: smtpPassword is not provided, should fallback to database value
      };

      const mockConnectionResult = {
        success: true,
        message: 'SMTP connection verified successfully',
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockDbConfig);
      mockEmailService.testSmtpConnection.mockResolvedValue(mockConnectionResult);

      const result = await controller.testSmtpConnection(mockFormConfig);

      expect(result.success).toBe(true);
      expect(result.details?.host).toBe('form-smtp.test.com');
      expect(result.details?.port).toBe(587);
      expect(result.details?.secure).toBe(false);
      
      // Verify that EmailService was called with the form data (service will handle merging)
      expect(mockEmailService.testSmtpConnection).toHaveBeenCalledWith(mockFormConfig);
    });

    it('should treat empty string form values as not provided and fallback to database values', async () => {
      const mockDbConfig = {
        emailEnabled: false,
        smtpHost: 'db-smtp.test.com',
        smtpPort: 25,
        smtpUsername: 'db@example.com',
        smtpPassword: 'dbpassword',
        smtpUseSsl: true,
        senderEmail: 'db-sender@example.com',
        senderName: 'DB Sender',
      };

      // Form data with empty strings (simulating frontend form submission)
      const mockFormConfig = {
        emailEnabled: true,
        smtpHost: 'form-smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'form@example.com',
        smtpPassword: '', // Empty string should fallback to database value
        smtpUseSsl: false,
        senderEmail: 'form-sender@example.com',
        senderName: '', // Empty string should fallback to database value
      };

      const mockConnectionResult = {
        success: true,
        message: 'SMTP connection verified successfully',
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockDbConfig);
      mockEmailService.testSmtpConnection.mockResolvedValue(mockConnectionResult);

      const result = await controller.testSmtpConnection(mockFormConfig);

      expect(result.success).toBe(true);
      expect(result.details?.host).toBe('form-smtp.test.com');
      expect(result.details?.port).toBe(587);
      expect(result.details?.secure).toBe(false);
      
      // Verify that EmailService was called with the form data (service will handle merging)
      expect(mockEmailService.testSmtpConnection).toHaveBeenCalledWith(mockFormConfig);
    });
  });
}); 