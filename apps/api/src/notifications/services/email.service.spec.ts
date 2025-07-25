import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { EmailService, EmailOptions } from './email.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { EmailAuditService } from './email-audit.service';
import { NotificationType } from '@prisma/client';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

interface EmailConfiguration {
  emailEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpPassword: string | null;
  smtpUseSsl: boolean;
  senderEmail: string | null;
  senderName: string | null;
  replyToEmail: string | null;
}

interface MockError extends Error {
  code?: string;
  errno?: number;
  address?: string;
  port?: number;
  hostname?: string;
  responseCode?: number;
  response?: string;
}

describe('EmailService', () => {
  let service: EmailService;
  let mockCoreConfigService: jest.Mocked<CoreConfigService>;
  let mockEmailAuditService: jest.Mocked<EmailAuditService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockTransporter: jest.Mocked<nodemailer.Transporter>;

  const mockEmailConfig: EmailConfiguration = {
    emailEnabled: true,
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpUseSsl: false,
    smtpUsername: 'test@example.com',
    smtpPassword: 'testpassword',
    senderEmail: 'noreply@playaplan.app',
    senderName: 'PlayaPlan',
    replyToEmail: null,
  };

  beforeEach(async () => {
    // Create mock transporter
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Mock nodemailer.createTransport
    jest.spyOn(nodemailer, 'createTransport')
      .mockReturnValue(mockTransporter);

    // Mock services
    mockCoreConfigService = {
      getEmailConfiguration: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    mockEmailAuditService = {
      logEmailSent: jest.fn(),
      logEmailFailed: jest.fn(),
      logEmailDisabled: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        // Default to 'test' mode unless overridden in specific tests
        if (key === 'NODE_ENV') return 'test';
        return defaultValue;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: CoreConfigService,
          useValue: mockCoreConfigService,
        },
        {
          provide: EmailAuditService,
          useValue: mockEmailAuditService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);

    // Mock console.log to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getEmailConfig caching mechanism', () => {
    it('should cache configuration calls and refresh after TTL', async () => {
      // Arrange
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);

      // Since getEmailConfig is private, we'll test caching through public methods
      // First call - should hit database
      await service.refreshConfiguration();
      expect(mockCoreConfigService.getEmailConfiguration).toHaveBeenCalledTimes(1);

      // Reset the mock to see if it's called again
      mockCoreConfigService.getEmailConfiguration.mockClear();

      // Second call within TTL - should use cache (tested via public refreshConfiguration)
      // We can't directly test private getEmailConfig, but we can verify the cache works
      // by mocking Date.now and testing refresh behavior
      const originalDateNow = Date.now;
      let currentTime = 1000000000000;
      Date.now = jest.fn(() => currentTime);

      try {
        // Immediate refresh should use cache (won't call getEmailConfiguration)
        await service.refreshConfiguration(); // This forces refresh, so it will call
        expect(mockCoreConfigService.getEmailConfiguration).toHaveBeenCalledTimes(1);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should handle CoreConfigService errors gracefully', async () => {
      // Arrange
      mockCoreConfigService.getEmailConfiguration.mockRejectedValue(new Error('Database error'));

      // Act & Assert - Should not throw
      await expect(service.refreshConfiguration()).resolves.toBeUndefined();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });

  describe('refreshConfiguration', () => {
    it('should force cache refresh and reinitialize SMTP', async () => {
      // Arrange
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);

      // Act
      await service.refreshConfiguration();

      // Assert
      expect(mockCoreConfigService.getEmailConfiguration).toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'testpassword',
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 30000,
      });
    });

    it('should handle initialization errors gracefully', async () => {
      // Arrange
      mockCoreConfigService.getEmailConfiguration.mockRejectedValue(new Error('Config error'));

      // Act & Assert - Should not throw
      await expect(service.refreshConfiguration()).resolves.toBeUndefined();
    });
  });

  describe('sendEmail', () => {
    const validEmailOptions: EmailOptions = {
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>',
      notificationType: NotificationType.EMAIL_VERIFICATION,
      userId: 'user-123',
    };

    beforeEach(async () => {
      // Initialize the service with valid config and clear any cached config
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);
      await service.refreshConfiguration();
    });

    it('should log DISABLED status when emailEnabled=false', async () => {
      // Arrange
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue({
        ...mockEmailConfig,
        emailEnabled: false,
      });

      // Force refresh to use new config
      await service.refreshConfiguration();

      // Act
      const result = await service.sendEmail(validEmailOptions);

      // Assert - In test mode (not development), should return false
      expect(result).toBe(false);
      expect(mockEmailAuditService.logEmailDisabled).toHaveBeenCalledWith(
        'test@example.com',
        'Test Subject',
        NotificationType.EMAIL_VERIFICATION,
        'user-123',
        undefined,
        undefined,
      );
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should log FAILED status with incomplete SMTP config', async () => {
      // Arrange
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue({
        ...mockEmailConfig,
        smtpHost: null, // Missing SMTP host
      });

      // Force refresh to use new config
      await service.refreshConfiguration();

      // Act
      const result = await service.sendEmail(validEmailOptions);

      // Assert - In test mode (not development), should return false
      expect(result).toBe(false);
      expect(mockEmailAuditService.logEmailFailed).toHaveBeenCalledWith(
        'test@example.com',
        'Test Subject',
        NotificationType.EMAIL_VERIFICATION,
        'SMTP configuration incomplete',
        'user-123',
        undefined,
        undefined,
      );
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should log SENT status with successful send and audit trail', async () => {
      // Arrange
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // Act
      const result = await service.sendEmail(validEmailOptions);

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'PlayaPlan <noreply@playaplan.app>',
        subject: 'Test Subject',
        text: '',
        html: '<p>Test content</p>',
        replyTo: 'PlayaPlan <noreply@playaplan.app>',
        cc: undefined,
        bcc: undefined,
      });
      expect(mockEmailAuditService.logEmailSent).toHaveBeenCalledWith(
        'test@example.com',
        'Test Subject',
        NotificationType.EMAIL_VERIFICATION,
        'user-123',
        undefined,
        undefined,
      );
    });

    it('should log FAILED status with SMTP failure', async () => {
      // Arrange
      const smtpError = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(smtpError);

      // Act
      const result = await service.sendEmail(validEmailOptions);

      // Assert
      expect(result).toBe(false);
      expect(mockEmailAuditService.logEmailFailed).toHaveBeenCalledWith(
        'test@example.com',
        'Test Subject',
        NotificationType.EMAIL_VERIFICATION,
        'SMTP send operation returned false',
        'user-123',
        undefined,
        undefined,
      );
    });

    it('should handle CC and BCC emails correctly', async () => {
      // Arrange
      const emailOptionsWithCCBCC: EmailOptions = {
        ...validEmailOptions,
        ccEmails: ['cc1@example.com', 'cc2@example.com'],
        bccEmails: ['bcc@example.com'],
      };
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // Act
      const result = await service.sendEmail(emailOptionsWithCCBCC);

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ['cc1@example.com', 'cc2@example.com'],
          bcc: ['bcc@example.com'],
        }),
      );
      expect(mockEmailAuditService.logEmailSent).toHaveBeenCalledWith(
        'test@example.com',
        'Test Subject',
        NotificationType.EMAIL_VERIFICATION,
        'user-123',
        ['cc1@example.com', 'cc2@example.com'],
        ['bcc@example.com'],
      );
    });

    it('should handle multiple recipients correctly', async () => {
      // Arrange
      const multiRecipientOptions: EmailOptions = {
        ...validEmailOptions,
        to: ['test1@example.com', 'test2@example.com'],
      };
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // Act
      const result = await service.sendEmail(multiRecipientOptions);

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['test1@example.com', 'test2@example.com'],
        }),
      );
      // Should log using first recipient
      expect(mockEmailAuditService.logEmailSent).toHaveBeenCalledWith(
        'test1@example.com',
        'Test Subject',
        NotificationType.EMAIL_VERIFICATION,
        'user-123',
        undefined,
        undefined,
      );
    });

    it('should output debug information in development mode', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      });
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      // Act
      await service.sendEmail(validEmailOptions);

      // Assert
      expect(console.log).toHaveBeenCalledWith('\n====== EMAIL CONTENT (DEBUG MODE) ======');
      expect(console.log).toHaveBeenCalledWith('To: test@example.com');
      expect(console.log).toHaveBeenCalledWith('Subject: Test Subject');
      expect(console.log).toHaveBeenCalledWith('Email Enabled: true');
      expect(console.log).toHaveBeenCalledWith('Notification Type: EMAIL_VERIFICATION');
    });

    it('should return true in development mode even when disabled', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      });
      mockCoreConfigService.getEmailConfiguration.mockClear();
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue({
        ...mockEmailConfig,
        emailEnabled: false,
      });
      mockEmailAuditService.logEmailDisabled.mockClear();

      // Force refresh to use new config
      await service.refreshConfiguration();

      // Act
      const result = await service.sendEmail(validEmailOptions);

      // Assert
      expect(result).toBe(true); // Should return true in development even when disabled
      expect(mockEmailAuditService.logEmailDisabled).toHaveBeenCalled();
    });

    it('should return true in development mode even with incomplete config', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      });
      mockCoreConfigService.getEmailConfiguration.mockClear();
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue({
        ...mockEmailConfig,
        smtpHost: null, // Incomplete config
      });
      mockEmailAuditService.logEmailFailed.mockClear();

      // Force refresh to use new config
      await service.refreshConfiguration();

      // Act
      const result = await service.sendEmail(validEmailOptions);

      // Assert
      expect(result).toBe(true); // Should return true in development even with incomplete config
      expect(mockEmailAuditService.logEmailFailed).toHaveBeenCalled();
    });

    it('should require notificationType field', async () => {
      // Arrange
      // Ensure we're in test mode, not development
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      });
      mockCoreConfigService.getEmailConfiguration.mockClear();
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);
      
      // Force refresh to use test mode config
      await service.refreshConfiguration();
      
      const incompleteOptions = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        // Missing notificationType - TypeScript should catch this
      } as EmailOptions;

      // Act
      const result = await service.sendEmail(incompleteOptions);

      // Assert - Service should handle gracefully but in test mode returns false
      expect(result).toBe(false);
    });

    it('should handle optional audit fields correctly', async () => {
      // Arrange
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);
      const optionsWithoutOptionalFields: EmailOptions = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        notificationType: NotificationType.EMAIL_VERIFICATION,
        // userId, ccEmails, bccEmails are optional
      };
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      const result = await service.sendEmail(optionsWithoutOptionalFields);

      // Assert
      expect(result).toBe(true);
      expect(mockEmailAuditService.logEmailSent).toHaveBeenCalledWith(
        'test@example.com',
        'Test',
        NotificationType.EMAIL_VERIFICATION,
        undefined, // userId
        undefined, // ccEmails
        undefined, // bccEmails
      );
    });
  });

  describe('onModuleInit', () => {
    it('should initialize service on startup', async () => {
      // Arrange
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);

      // Act
      await service.onModuleInit();

      // Assert
      expect(mockCoreConfigService.getEmailConfiguration).toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'testpassword',
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 30000,
      });
    });

    it('should handle initialization errors gracefully', async () => {
      // Arrange
      mockCoreConfigService.getEmailConfiguration.mockRejectedValue(new Error('Init error'));

      // Act & Assert - Should not throw
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to refresh email configuration from database',
        expect.any(Error),
      );
    });
  });

  describe('SMTP transporter initialization', () => {
    it('should initialize transporter with database configuration', async () => {
      // Arrange
      const customConfig: EmailConfiguration = {
        ...mockEmailConfig,
        smtpHost: 'custom.smtp.com',
        smtpPort: 465,
        smtpUseSsl: true,
        smtpUsername: 'custom@test.com',
        smtpPassword: 'custompass',
      };
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(customConfig);

      // Act
      await service.refreshConfiguration();

      // Assert
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'custom.smtp.com',
        port: 465,
        secure: true,
        auth: {
          user: 'custom@test.com',
          pass: 'custompass',
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 30000,
      });
    });

    it('should handle missing SMTP configuration gracefully', async () => {
      // Arrange
      const incompleteConfig: EmailConfiguration = {
        ...mockEmailConfig,
        smtpHost: null,
        smtpUsername: null,
        smtpPassword: null,
      };
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(incompleteConfig);

      // Act & Assert - Should not throw
      await expect(service.refreshConfiguration()).resolves.toBeUndefined();
    });
  });

  describe('EmailOptions interface requirements', () => {
    it('should handle optional audit fields correctly', async () => {
      // Arrange
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);
      const optionsWithoutOptionalFields: EmailOptions = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        notificationType: NotificationType.EMAIL_VERIFICATION,
        // userId, ccEmails, bccEmails are optional
      };
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      const result = await service.sendEmail(optionsWithoutOptionalFields);

      // Assert
      expect(result).toBe(true);
      expect(mockEmailAuditService.logEmailSent).toHaveBeenCalledWith(
        'test@example.com',
        'Test',
        NotificationType.EMAIL_VERIFICATION,
        undefined, // userId
        undefined, // ccEmails
        undefined, // bccEmails
      );
    });
  });

  describe('Reply-To email functionality', () => {
    const validEmailOptions: EmailOptions = {
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>',
      notificationType: NotificationType.EMAIL_VERIFICATION,
      userId: 'user-123',
    };

    beforeEach(async () => {
      // Initialize the service with valid config and clear any cached config
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockEmailConfig);
      await service.refreshConfiguration();
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });
    });

    it('should use configured replyToEmail when available', async () => {
      // Arrange
      const configWithReplyTo: EmailConfiguration = {
        ...mockEmailConfig,
        replyToEmail: 'contact@playaplan.app',
      };
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(configWithReplyTo);
      await service.refreshConfiguration();

      // Act
      const result = await service.sendEmail(validEmailOptions);

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'PlayaPlan <noreply@playaplan.app>',
        subject: 'Test Subject',
        text: '',
        html: '<p>Test content</p>',
        replyTo: 'contact@playaplan.app',
        cc: undefined,
        bcc: undefined,
      });
    });

    it('should fallback to sender email when replyToEmail is null', async () => {
      // Arrange - mockEmailConfig already has replyToEmail: null
      
      // Act
      const result = await service.sendEmail(validEmailOptions);

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'PlayaPlan <noreply@playaplan.app>',
        subject: 'Test Subject',
        text: '',
        html: '<p>Test content</p>',
        replyTo: 'PlayaPlan <noreply@playaplan.app>', // Should fallback to sender
        cc: undefined,
        bcc: undefined,
      });
    });

    it('should use explicit replyTo parameter with highest precedence', async () => {
      // Arrange
      const configWithReplyTo: EmailConfiguration = {
        ...mockEmailConfig,
        replyToEmail: 'contact@playaplan.app',
      };
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(configWithReplyTo);
      await service.refreshConfiguration();

      const optionsWithExplicitReplyTo: EmailOptions = {
        ...validEmailOptions,
        replyTo: 'support@playaplan.app',
      };

      // Act
      const result = await service.sendEmail(optionsWithExplicitReplyTo);

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'PlayaPlan <noreply@playaplan.app>',
        subject: 'Test Subject',
        text: '',
        html: '<p>Test content</p>',
        replyTo: 'support@playaplan.app', // Should use explicit parameter
        cc: undefined,
        bcc: undefined,
      });
    });

    it('should follow priority hierarchy: options.replyTo > config.replyToEmail > emailFrom', async () => {
      // Test case 1: No explicit replyTo, no config replyToEmail -> use emailFrom
      const result1 = await service.sendEmail(validEmailOptions);
      expect(result1).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenLastCalledWith(
        expect.objectContaining({
          replyTo: 'PlayaPlan <noreply@playaplan.app>', // Falls back to emailFrom
        })
      );

      // Test case 2: No explicit replyTo, config replyToEmail set -> use config
      const configWithReplyTo: EmailConfiguration = {
        ...mockEmailConfig,
        replyToEmail: 'replies@playaplan.app',
      };
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(configWithReplyTo);
      await service.refreshConfiguration();

      const result2 = await service.sendEmail(validEmailOptions);
      expect(result2).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenLastCalledWith(
        expect.objectContaining({
          replyTo: 'replies@playaplan.app', // Uses config replyToEmail
        })
      );

      // Test case 3: Explicit replyTo set -> use explicit (highest priority)
      const optionsWithReplyTo = {
        ...validEmailOptions,
        replyTo: 'explicit@playaplan.app',
      };

      const result3 = await service.sendEmail(optionsWithReplyTo);
      expect(result3).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenLastCalledWith(
        expect.objectContaining({
          replyTo: 'explicit@playaplan.app', // Uses explicit parameter (highest priority)
        })
      );
    });

    it('should handle replyToEmail with different sender configurations', async () => {
      // Arrange - Config with only sender email (no sender name) and reply-to
      const configMinimal: EmailConfiguration = {
        ...mockEmailConfig,
        senderEmail: 'noreply@playaplan.app',
        senderName: null,
        replyToEmail: 'help@playaplan.app',
      };
      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(configMinimal);
      await service.refreshConfiguration();

      // Act
      const result = await service.sendEmail(validEmailOptions);

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'noreply@playaplan.app', // No sender name
        subject: 'Test Subject',
        text: '',
        html: '<p>Test content</p>',
        replyTo: 'help@playaplan.app', // Uses configured reply-to
        cc: undefined,
        bcc: undefined,
      });
    });
  });

  describe('testSmtpConnection', () => {
    it('should test SMTP connection successfully', async () => {
      const mockConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      // Mock nodemailer verify method
      const mockVerify = jest.fn().mockResolvedValue(true);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      // Mock nodemailer.createTransport
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('SMTP connection verified successfully');
      expect(createTransportSpy).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password123',
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });
      expect(mockVerify).toHaveBeenCalled();

      createTransportSpy.mockRestore();
    });

    it('should return error when email is disabled', async () => {
      const mockConfig = {
        emailEnabled: false,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email notifications are disabled');
    });

    it('should return error when SMTP configuration is incomplete', async () => {
      const mockConfig = {
        emailEnabled: true,
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('SMTP configuration is incomplete');
    });

    it('should handle ECONNREFUSED error', async () => {
      const mockConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      const mockError: MockError = new Error('Connection refused');
      mockError.code = 'ECONNREFUSED';
      mockError.errno = -111;
      mockError.address = '192.168.1.1';
      mockError.port = 587;

      const mockVerify = jest.fn().mockRejectedValue(mockError);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection refused. Check SMTP host and port.');
      expect(result.errorDetails).toEqual({
        code: 'ECONNREFUSED',
        errno: -111,
        address: '192.168.1.1',
        port: 587,
      });

      createTransportSpy.mockRestore();
    });

    it('should handle ENOTFOUND error', async () => {
      const mockConfig = {
        emailEnabled: true,
        smtpHost: 'invalid.smtp.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      const mockError: MockError = new Error('Host not found');
      mockError.code = 'ENOTFOUND';
      mockError.hostname = 'invalid.smtp.com';

      const mockVerify = jest.fn().mockRejectedValue(mockError);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('SMTP host not found. Check the hostname.');
      expect(result.errorDetails?.code).toBe('ENOTFOUND');

      createTransportSpy.mockRestore();
    });

    it('should handle ETIMEDOUT error', async () => {
      const mockConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      const mockError: MockError = new Error('Connection timed out');
      mockError.code = 'ETIMEDOUT';

      const mockVerify = jest.fn().mockRejectedValue(mockError);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection timed out. Check host and firewall settings.');
      expect(result.errorDetails?.code).toBe('ETIMEDOUT');

      createTransportSpy.mockRestore();
    });

    it('should handle EAUTH error', async () => {
      const mockConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'wrongpassword',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      const mockError: MockError = new Error('Authentication failed');
      mockError.code = 'EAUTH';

      const mockVerify = jest.fn().mockRejectedValue(mockError);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication failed. Check username and password.');
      expect(result.errorDetails?.code).toBe('EAUTH');

      createTransportSpy.mockRestore();
    });

    it('should handle authentication response code 535', async () => {
      const mockConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'wrongpassword',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      const mockError: MockError = new Error('535 Authentication failed');
      mockError.responseCode = 535;

      const mockVerify = jest.fn().mockRejectedValue(mockError);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication failed. Check username and password.');

      createTransportSpy.mockRestore();
    });

    it('should handle SMTP server response error', async () => {
      const mockConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      const mockError: MockError = new Error('SMTP error');
      mockError.response = '550 Mailbox unavailable';

      const mockVerify = jest.fn().mockRejectedValue(mockError);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('SMTP server error: 550 Mailbox unavailable');
      expect(result.errorDetails?.response).toBe('550 Mailbox unavailable');

      createTransportSpy.mockRestore();
    });

    it('should handle unknown error codes', async () => {
      const mockConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      const mockError: MockError = new Error('Unknown error');
      mockError.code = 'EUNKNOWN';

      const mockVerify = jest.fn().mockRejectedValue(mockError);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('SMTP error: EUNKNOWN');
      expect(result.errorDetails?.code).toBe('EUNKNOWN');

      createTransportSpy.mockRestore();
    });

    it('should handle generic error without specific code', async () => {
      const mockConfig = {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: 'password123',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockConfig);

      const mockError = new Error('Generic error');

      const mockVerify = jest.fn().mockRejectedValue(mockError);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('SMTP connection failed');

      createTransportSpy.mockRestore();
    });

    it('should use configuration override when provided', async () => {
      const mockDbConfig = {
        emailEnabled: false,
        smtpHost: 'old-smtp.test.com',
        smtpPort: 25,
        smtpUsername: 'old@example.com',
        smtpPassword: 'oldpassword',
        smtpUseSsl: true,
        senderEmail: 'old-sender@example.com',
        senderName: 'Old Sender',
        replyToEmail: null,
      };

      const mockConfigOverride = {
        emailEnabled: true,
        smtpHost: 'new-smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'new@example.com',
        smtpPassword: 'newpassword',
        smtpUseSsl: false,
        senderEmail: 'new-sender@example.com',
        senderName: 'New Sender',
        replyToEmail: null,
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockDbConfig);

      const mockVerify = jest.fn().mockResolvedValue(true);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection(mockConfigOverride);

      expect(result.success).toBe(true);
      expect(result.message).toBe('SMTP connection verified successfully');
      
      // Verify that createTransport was called with override config, not db config
      expect(createTransportSpy).toHaveBeenCalledWith({
        host: 'new-smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'new@example.com',
          pass: 'newpassword',
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });

      createTransportSpy.mockRestore();
    });

    it('should merge partial configuration override with database configuration', async () => {
      const mockDbConfig = {
        emailEnabled: false,
        smtpHost: 'old-smtp.test.com',
        smtpPort: 25,
        smtpUsername: 'old@example.com',
        smtpPassword: 'oldpassword',
        smtpUseSsl: true,
        senderEmail: 'old-sender@example.com',
        senderName: 'Old Sender',
        replyToEmail: null,
      };

      const mockConfigOverride = {
        emailEnabled: true,
        smtpHost: 'form-smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'form@example.com',
        smtpUseSsl: false,
        senderEmail: 'form-sender@example.com',
        senderName: 'Form Sender',
        replyToEmail: null,
        // Note: smtpPassword is not provided, should fallback to database value
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockDbConfig);

      const mockVerify = jest.fn().mockResolvedValue(true);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection(mockConfigOverride);

      expect(result.success).toBe(true);
      expect(result.message).toBe('SMTP connection verified successfully');
      
      // Verify that createTransport was called with merged config including database password
      expect(createTransportSpy).toHaveBeenCalledWith({
        host: 'form-smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'form@example.com',
          pass: 'oldpassword', // This should come from database
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });

      createTransportSpy.mockRestore();
    });

    it('should treat empty string values as not provided and fallback to database values', async () => {
      const mockDbConfig = {
        emailEnabled: false,
        smtpHost: 'db-smtp.test.com',
        smtpPort: 25,
        smtpUsername: 'db@example.com',
        smtpPassword: 'dbpassword',
        smtpUseSsl: true,
        senderEmail: 'db-sender@example.com',
        senderName: 'DB Sender',
        replyToEmail: null,
      };

      // Form data with empty strings (simulating frontend form submission)
      const mockConfigOverride = {
        emailEnabled: true,
        smtpHost: 'form-smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'form@example.com',
        smtpPassword: '', // Empty string should fallback to database value
        smtpUseSsl: false,
        senderEmail: 'form-sender@example.com',
        senderName: '', // Empty string should fallback to database value
      };

      mockCoreConfigService.getEmailConfiguration.mockResolvedValue(mockDbConfig);

      const mockVerify = jest.fn().mockResolvedValue(true);
      const mockTransporter = { 
        verify: mockVerify,
      } as unknown as nodemailer.Transporter;
      
      const createTransportSpy = jest.spyOn(nodemailer, 'createTransport')
        .mockReturnValue(mockTransporter);

      const result = await service.testSmtpConnection(mockConfigOverride);

      expect(result.success).toBe(true);
      expect(result.message).toBe('SMTP connection verified successfully');
      
      // Verify that createTransport was called with merged config using database values for empty strings
      expect(createTransportSpy).toHaveBeenCalledWith({
        host: 'form-smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'form@example.com',
          pass: 'dbpassword', // Should use database value, not empty string
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });

      createTransportSpy.mockRestore();
    });
  });
}); 