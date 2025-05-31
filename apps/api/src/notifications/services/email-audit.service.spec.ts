import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailAuditService, EmailAuditData } from './email-audit.service';
import { EmailAuditStatus, NotificationType } from '@prisma/client';

describe('EmailAuditService', () => {
  let service: EmailAuditService;

  const mockEmailAuditCreate = jest.fn();
  const mockEmailAuditFindMany = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailAuditService,
        {
          provide: PrismaService,
          useValue: {
            emailAudit: {
              create: mockEmailAuditCreate,
              findMany: mockEmailAuditFindMany,
            },
          },
        },
      ],
    }).compile();

    service = module.get<EmailAuditService>(EmailAuditService);

    // Spy on logger to avoid actual logging during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logEmailAttempt', () => {
    it('should log email attempt with all audit data fields', async () => {
      // Arrange
      const auditData: EmailAuditData = {
        recipientEmail: 'test@example.com',
        ccEmails: ['cc1@example.com', 'cc2@example.com'],
        bccEmails: ['bcc1@example.com'],
        subject: 'Test Subject',
        notificationType: NotificationType.EMAIL_VERIFICATION,
        userId: 'user-123',
        status: EmailAuditStatus.SENT,
        errorMessage: undefined,
        sentAt: new Date('2023-01-15T10:00:00Z'),
      };

      const mockCreatedAudit = {
        id: 'audit-123',
        ...auditData,
        ccEmails: 'cc1@example.com,cc2@example.com',
        bccEmails: 'bcc1@example.com',
        errorMessage: null,
        createdAt: new Date(),
      };

      mockEmailAuditCreate.mockResolvedValue(mockCreatedAudit);

      // Act
      await service.logEmailAttempt(auditData);

      // Assert
      expect(mockEmailAuditCreate).toHaveBeenCalledWith({
        data: {
          recipientEmail: 'test@example.com',
          ccEmails: 'cc1@example.com,cc2@example.com',
          bccEmails: 'bcc1@example.com',
          subject: 'Test Subject',
          notificationType: NotificationType.EMAIL_VERIFICATION,
          status: EmailAuditStatus.SENT,
          errorMessage: null,
          sentAt: auditData.sentAt,
          userId: 'user-123',
          createdAt: expect.any(Date),
        },
      });
    });

    it('should handle database errors gracefully without throwing', async () => {
      // Arrange
      const auditData: EmailAuditData = {
        recipientEmail: 'test@example.com',
        subject: 'Test Subject',
        notificationType: NotificationType.EMAIL_VERIFICATION,
        status: EmailAuditStatus.FAILED,
        errorMessage: 'SMTP connection failed',
      };

      mockEmailAuditCreate.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert - Should not throw
      await expect(service.logEmailAttempt(auditData)).resolves.toBeUndefined();
      
      // Verify error was logged
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to log email audit for test@example.com',
        expect.any(Error)
      );
    });

    it('should properly serialize CC/BCC email arrays as comma-separated strings', async () => {
      // Arrange
      const auditData: EmailAuditData = {
        recipientEmail: 'test@example.com',
        ccEmails: ['cc1@example.com', 'cc2@example.com', 'cc3@example.com'],
        bccEmails: ['bcc1@example.com', 'bcc2@example.com'],
        subject: 'Test Subject',
        notificationType: NotificationType.PAYMENT_CONFIRMATION,
        status: EmailAuditStatus.SENT,
      };

      mockEmailAuditCreate.mockResolvedValue({});

      // Act
      await service.logEmailAttempt(auditData);

      // Assert
      expect(mockEmailAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ccEmails: 'cc1@example.com,cc2@example.com,cc3@example.com',
          bccEmails: 'bcc1@example.com,bcc2@example.com',
        }),
      });
    });

    it('should handle undefined/null CC/BCC arrays', async () => {
      // Arrange
      const auditData: EmailAuditData = {
        recipientEmail: 'test@example.com',
        subject: 'Test Subject',
        notificationType: NotificationType.PASSWORD_RESET,
        status: EmailAuditStatus.SENT,
      };

      mockEmailAuditCreate.mockResolvedValue({});

      // Act
      await service.logEmailAttempt(auditData);

      // Assert
      expect(mockEmailAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ccEmails: null,
          bccEmails: null,
        }),
      });
    });
  });

  describe('logEmailSent', () => {
    it('should create SENT audit record with sentAt timestamp', async () => {
      // Arrange
      const recipientEmail = 'recipient@example.com';
      const subject = 'Welcome Email';
      const notificationType = NotificationType.EMAIL_VERIFICATION;
      const userId = 'user-456';
      const ccEmails = ['cc@example.com'];
      const bccEmails = ['bcc@example.com'];

      mockEmailAuditCreate.mockResolvedValue({});

      // Act
      await service.logEmailSent(recipientEmail, subject, notificationType, userId, ccEmails, bccEmails);

      // Assert
      expect(mockEmailAuditCreate).toHaveBeenCalledWith({
        data: {
          recipientEmail,
          ccEmails: 'cc@example.com',
          bccEmails: 'bcc@example.com',
          subject,
          notificationType,
          userId,
          status: EmailAuditStatus.SENT,
          errorMessage: null,
          sentAt: expect.any(Date),
          createdAt: expect.any(Date),
        },
      });

      // Verify sentAt is set to current time (within 1 second)
      const callArgs = mockEmailAuditCreate.mock.calls[0][0];
      const sentAt = callArgs.data.sentAt;
      const now = new Date();
      expect(Math.abs(sentAt.getTime() - now.getTime())).toBeLessThan(1000);
    });

    it('should handle optional parameters correctly', async () => {
      // Arrange
      const recipientEmail = 'recipient@example.com';
      const subject = 'Test Email';
      const notificationType = NotificationType.REGISTRATION_CONFIRMATION;

      mockEmailAuditCreate.mockResolvedValue({});

      // Act
      await service.logEmailSent(recipientEmail, subject, notificationType);

      // Assert
      expect(mockEmailAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipientEmail,
          subject,
          notificationType,
          status: EmailAuditStatus.SENT,
          userId: null,
          ccEmails: null,
          bccEmails: null,
        }),
      });
    });
  });

  describe('logEmailFailed', () => {
    it('should create FAILED audit record with error message', async () => {
      // Arrange
      const recipientEmail = 'recipient@example.com';
      const subject = 'Failed Email';
      const notificationType = NotificationType.PASSWORD_RESET;
      const errorMessage = 'SMTP authentication failed';
      const userId = 'user-789';

      mockEmailAuditCreate.mockResolvedValue({});

      // Act
      await service.logEmailFailed(recipientEmail, subject, notificationType, errorMessage, userId);

      // Assert
      expect(mockEmailAuditCreate).toHaveBeenCalledWith({
        data: {
          recipientEmail,
          ccEmails: null,
          bccEmails: null,
          subject,
          notificationType,
          userId,
          status: EmailAuditStatus.FAILED,
          errorMessage,
          sentAt: null,
          createdAt: expect.any(Date),
        },
      });
    });

    it('should handle missing optional parameters', async () => {
      // Arrange
      const recipientEmail = 'recipient@example.com';
      const subject = 'Failed Email';
      const notificationType = NotificationType.EMAIL_AUTHENTICATION;
      const errorMessage = 'Network timeout';

      mockEmailAuditCreate.mockResolvedValue({});

      // Act
      await service.logEmailFailed(recipientEmail, subject, notificationType, errorMessage);

      // Assert
      expect(mockEmailAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: EmailAuditStatus.FAILED,
          errorMessage,
          userId: null,
          sentAt: null,
        }),
      });
    });
  });

  describe('logEmailDisabled', () => {
    it('should create DISABLED audit record', async () => {
      // Arrange
      const recipientEmail = 'recipient@example.com';
      const subject = 'Disabled Email';
      const notificationType = NotificationType.REGISTRATION_ERROR;
      const userId = 'user-disabled';
      const ccEmails = ['cc@example.com'];

      mockEmailAuditCreate.mockResolvedValue({});

      // Act
      await service.logEmailDisabled(recipientEmail, subject, notificationType, userId, ccEmails);

      // Assert
      expect(mockEmailAuditCreate).toHaveBeenCalledWith({
        data: {
          recipientEmail,
          ccEmails: 'cc@example.com',
          bccEmails: null,
          subject,
          notificationType,
          userId,
          status: EmailAuditStatus.DISABLED,
          errorMessage: null,
          sentAt: null,
          createdAt: expect.any(Date),
        },
      });
    });

    it('should handle all optional parameters as undefined', async () => {
      // Arrange
      const recipientEmail = 'recipient@example.com';
      const subject = 'Disabled Email';
      const notificationType = NotificationType.EMAIL_CHANGE;

      mockEmailAuditCreate.mockResolvedValue({});

      // Act
      await service.logEmailDisabled(recipientEmail, subject, notificationType);

      // Assert
      expect(mockEmailAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: EmailAuditStatus.DISABLED,
          userId: null,
          ccEmails: null,
          bccEmails: null,
        }),
      });
    });
  });

  describe('getEmailStatistics', () => {
    it('should return correct counts and breakdown by notification type', async () => {
      // Arrange
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      const mockAudits = [
        { status: EmailAuditStatus.SENT, notificationType: NotificationType.EMAIL_VERIFICATION },
        { status: EmailAuditStatus.SENT, notificationType: NotificationType.EMAIL_VERIFICATION },
        { status: EmailAuditStatus.FAILED, notificationType: NotificationType.PASSWORD_RESET },
        { status: EmailAuditStatus.DISABLED, notificationType: NotificationType.PAYMENT_CONFIRMATION },
        { status: EmailAuditStatus.SENT, notificationType: NotificationType.REGISTRATION_CONFIRMATION },
        { status: EmailAuditStatus.FAILED, notificationType: NotificationType.EMAIL_VERIFICATION },
      ];

      mockEmailAuditFindMany.mockResolvedValue(mockAudits);

      // Act
      const result = await service.getEmailStatistics(startDate, endDate);

      // Assert
      expect(mockEmailAuditFindMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          status: true,
          notificationType: true,
        },
      });

      expect(result).toEqual({
        totalEmails: 6,
        sentEmails: 3,
        failedEmails: 2,
        disabledEmails: 1,
        byNotificationType: {
          [NotificationType.EMAIL_VERIFICATION]: 3,
          [NotificationType.PASSWORD_RESET]: 1,
          [NotificationType.PAYMENT_CONFIRMATION]: 1,
          [NotificationType.REGISTRATION_CONFIRMATION]: 1,
        },
      });
    });

    it('should handle empty result set', async () => {
      // Arrange
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      mockEmailAuditFindMany.mockResolvedValue([]);

      // Act
      const result = await service.getEmailStatistics(startDate, endDate);

      // Assert
      expect(result).toEqual({
        totalEmails: 0,
        sentEmails: 0,
        failedEmails: 0,
        disabledEmails: 0,
        byNotificationType: {},
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      mockEmailAuditFindMany.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.getEmailStatistics(startDate, endDate);

      // Assert
      expect(result).toEqual({
        totalEmails: 0,
        sentEmails: 0,
        failedEmails: 0,
        disabledEmails: 0,
        byNotificationType: {},
      });

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to get email statistics',
        expect.any(Error)
      );
    });

    it('should correctly aggregate duplicate notification types', async () => {
      // Arrange
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      const mockAudits = [
        { status: EmailAuditStatus.SENT, notificationType: NotificationType.EMAIL_VERIFICATION },
        { status: EmailAuditStatus.SENT, notificationType: NotificationType.EMAIL_VERIFICATION },
        { status: EmailAuditStatus.SENT, notificationType: NotificationType.EMAIL_VERIFICATION },
        { status: EmailAuditStatus.FAILED, notificationType: NotificationType.EMAIL_VERIFICATION },
      ];

      mockEmailAuditFindMany.mockResolvedValue(mockAudits);

      // Act
      const result = await service.getEmailStatistics(startDate, endDate);

      // Assert
      expect(result.byNotificationType[NotificationType.EMAIL_VERIFICATION]).toBe(4);
      expect(result.totalEmails).toBe(4);
      expect(result.sentEmails).toBe(3);
      expect(result.failedEmails).toBe(1);
    });
  });
}); 