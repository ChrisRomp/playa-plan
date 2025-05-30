import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../services/notifications.service';
import { EmailService } from '../services/email.service';
import { EmailAuditService } from '../services/email-audit.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SendEmailDto, SendEmailToMultipleRecipientsDto } from '../dto/send-email.dto';
import { NotificationType, UserRole } from '@prisma/client';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: NotificationsService;
  let emailService: EmailService;
  let emailAuditService: EmailAuditService;
  let coreConfigService: CoreConfigService;
  let prismaService: PrismaService;

  const mockNotificationsService = {
    sendEmailVerificationEmail: jest.fn(),
    sendTestEmail: jest.fn(),
  };

  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  const mockEmailAuditService = {
    getEmailStatistics: jest.fn(),
  };

  const mockCoreConfigService = {
    getEmailConfiguration: jest.fn(),
  };

  const mockPrismaService = {
    emailAudit: {
      findMany: jest.fn(),
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
    notificationsService = module.get<NotificationsService>(NotificationsService);
    emailService = module.get<EmailService>(EmailService);
    emailAuditService = module.get<EmailAuditService>(EmailAuditService);
    coreConfigService = module.get<CoreConfigService>(CoreConfigService);
    prismaService = module.get<PrismaService>(PrismaService);
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
      const result = await controller.sendTestEmail('test@example.playaplan.app', mockRequest as any);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Test email sent successfully');
      expect(result.auditRecordId).toBe('audit-123');
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
        'user-123'
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
      const result = await controller.sendTestEmail('test@example.playaplan.app', mockRequest as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Email sending is currently disabled');
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
}); 