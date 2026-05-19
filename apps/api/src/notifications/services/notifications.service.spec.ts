import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { NotificationType } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let emailService: EmailService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let configService: ConfigService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let coreConfigService: CoreConfigService;

  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'app.baseUrl') return 'http://test.com';
      if (key === 'nodeEnv') return 'test';
      return defaultValue;
    }),
  };

  const mockCoreConfigService = {
    findCurrent: jest.fn().mockResolvedValue({
      campName: 'Test Camp',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CoreConfigService,
          useValue: mockCoreConfigService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    emailService = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
    coreConfigService = module.get<CoreConfigService>(CoreConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with token', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await service.sendPasswordResetEmail('user@example.playaplan.app', 'reset-token-123');

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          subject: expect.stringContaining('Reset'),
          html: expect.stringContaining('http://test.com/reset-password?token=reset-token-123'),
          text: expect.stringContaining('http://test.com/reset-password?token=reset-token-123'),
          notificationType: NotificationType.PASSWORD_RESET,
        }),
      );
    });
  });

  describe('sendEmailVerificationEmail', () => {
    it('should send email verification with token', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await service.sendEmailVerificationEmail('user@example.playaplan.app', 'verify-token-123');

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          subject: expect.stringContaining('Verify'),
          html: expect.stringContaining('http://test.com/verify-email?token=verify-token-123'),
          text: expect.stringContaining('http://test.com/verify-email?token=verify-token-123'),
          notificationType: NotificationType.EMAIL_VERIFICATION,
        }),
      );
    });
  });

  describe('sendPaymentConfirmationEmail', () => {
    it('should send payment confirmation email', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const paymentDetails = {
        id: 'payment-123',
        amount: 5000, // $50.00
        currency: 'USD',
        date: new Date('2023-01-15'),
      };

      const result = await service.sendPaymentConfirmationEmail('user@example.playaplan.app', paymentDetails);

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          subject: expect.stringContaining('Payment'),
          html: expect.stringContaining('payment-123'),
          text: expect.stringContaining('payment-123'),
          notificationType: NotificationType.PAYMENT_CONFIRMATION,
        }),
      );
    });
  });

  describe('sendLoginCodeEmail', () => {
    it('should send login code email', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await service.sendLoginCodeEmail('user@example.playaplan.app', '123456');

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          subject: expect.stringContaining('Login'),
          html: expect.stringContaining('123456'),
          text: expect.stringContaining('123456'),
          notificationType: NotificationType.EMAIL_AUTHENTICATION,
        }),
      );
    });
  });

  describe('sendRegistrationConfirmationEmail', () => {
    it('should send registration confirmation email', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const registrationDetails = {
        id: 'registration-123',
        year: 2024,
        status: 'CONFIRMED',
        jobs: [{
          name: 'Greeter',
          category: 'Guest Services',
          shift: {
            name: 'Morning Shift',
            startTime: '09:00',
            endTime: '12:00',
            dayOfWeek: 'MONDAY',
          },
          location: 'Main Gate',
        }],
        totalCost: 450,
        currency: 'USD',
      };

      const result = await service.sendRegistrationConfirmationEmail(
        'user@example.playaplan.app', 
        registrationDetails,
        'user-123',
        'John Doe',
        'BurnerName'
      );

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          subject: expect.stringContaining('Registration'),
          html: expect.not.stringContaining('registration-123'),
          text: expect.not.stringContaining('registration-123'),
          notificationType: NotificationType.REGISTRATION_CONFIRMATION,
          userId: 'user-123',
        }),
      );
    });

    it('should send registration confirmation email with camping options showing simplified format', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const registrationDetails = {
        id: 'registration-123',
        year: 2024,
        status: 'CONFIRMED',
        campingOptions: [
          {
            name: 'Skydiving',
            description: 'Skydiving camp option'
          },
          {
            name: 'Photography',
            description: 'Photography camp option'
          }
        ],
        jobs: [],
        totalCost: 450,
        currency: 'USD',
      };

      const result = await service.sendRegistrationConfirmationEmail(
        'user@example.playaplan.app', 
        registrationDetails,
        'user-123',
        'John Doe',
        'BurnerName'
      );

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          subject: expect.stringContaining('Registration'),
          // Verify the simplified format shows only the name without description
          html: expect.stringContaining('<li>Skydiving</li>'),
          text: expect.stringContaining('- Skydiving'),
          notificationType: NotificationType.REGISTRATION_CONFIRMATION,
          userId: 'user-123',
        }),
      );

      // Verify it does NOT contain the old format with description in parentheses
      const callArgs = mockEmailService.sendEmail.mock.calls[0][0];
      expect(callArgs.html).not.toContain('(Skydiving camp option)');
      expect(callArgs.text).not.toContain('(Skydiving camp option)');
    });

    it('should send registration confirmation email with userName fallback when no playaName', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const registrationDetails = {
        id: 'registration-456',
        year: 2024,
        status: 'PENDING',
        jobs: [],
        totalCost: 200,
        currency: 'USD',
      };

      const result = await service.sendRegistrationConfirmationEmail(
        'user@example.playaplan.app', 
        registrationDetails,
        'user-123',
        'Jane Smith'
      );

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          subject: expect.stringContaining('Registration'),
          html: expect.stringContaining('Hi Jane Smith,'),
          text: expect.stringContaining('Hi Jane Smith,'),
          notificationType: NotificationType.REGISTRATION_CONFIRMATION,
          userId: 'user-123',
        }),
      );
    });

    it('should send registration confirmation email with generic greeting when no names provided', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const registrationDetails = {
        id: 'registration-789',
        year: 2024,
        status: 'PENDING',
        jobs: [],
        totalCost: 200,
        currency: 'USD',
      };

      const result = await service.sendRegistrationConfirmationEmail(
        'user@example.playaplan.app', 
        registrationDetails,
        'user-123'
      );

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          subject: expect.stringContaining('Registration'),
          html: expect.stringContaining('Hi there,'),
          text: expect.stringContaining('Hi there,'),
          notificationType: NotificationType.REGISTRATION_CONFIRMATION,
          userId: 'user-123',
        }),
      );
    });
  });

  describe('sendRegistrationErrorEmail', () => {
    it('should send registration error email', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const errorDetails = {
        error: 'PAYMENT_FAILED',
        message: 'Your payment could not be processed',
        suggestions: ['Check your card details', 'Try a different payment method'],
      };

      const result = await service.sendRegistrationErrorEmail(
        'user@example.playaplan.app', 
        errorDetails,
        'user-123'
      );

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          subject: expect.stringContaining('Registration'),
          html: expect.stringContaining('PAYMENT_FAILED'),
          text: expect.stringContaining('PAYMENT_FAILED'),
          notificationType: NotificationType.REGISTRATION_ERROR,
          userId: 'user-123',
        }),
      );
    });
  });

  describe('sendTestEmail', () => {
    const mockTestEmailDetails = {
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: false,
      senderEmail: 'admin@example.playaplan.app',
      senderName: 'PlayaPlan',
      adminUserName: 'Admin User',
      adminEmail: 'admin@example.playaplan.app',
      timestamp: new Date('2026-01-01T00:00:00Z'),
    } as const;
    const inputUserId = 'user-123';

    it('should throw when recipient is empty string', async () => {
      const inputEmail = '';

      await expect(
        service.sendTestEmail(inputEmail, mockTestEmailDetails, inputUserId),
      ).rejects.toThrow('At least one recipient email address is required.');
    });

    it('should throw when recipient is only whitespace/commas', async () => {
      const inputEmail = ' , , ';

      await expect(
        service.sendTestEmail(inputEmail, mockTestEmailDetails, inputUserId),
      ).rejects.toThrow('At least one recipient email address is required.');
    });

    it('should throw when email address is invalid', async () => {
      const inputEmail = 'not-an-email';

      await expect(
        service.sendTestEmail(inputEmail, mockTestEmailDetails, inputUserId),
      ).rejects.toThrow('Invalid email address: not-an-email');
    });

    it('should throw before sending when any recipient in the list is invalid', async () => {
      const inputEmail = 'valid@example.playaplan.app, not-an-email';
      const sendNotificationSpy = jest.spyOn(service, 'sendNotification');

      await expect(
        service.sendTestEmail(inputEmail, mockTestEmailDetails, inputUserId),
      ).rejects.toThrow('Invalid email address: not-an-email');
      expect(sendNotificationSpy).not.toHaveBeenCalled();
    });

    it('should send successfully for a single valid recipient', async () => {
      const inputEmail = 'recipient@example.playaplan.app';
      jest.spyOn(service, 'sendNotification').mockResolvedValueOnce(true);

      const actualResult = await service.sendTestEmail(inputEmail, mockTestEmailDetails, inputUserId);

      const expectedResult = { success: true, recipients: ['recipient@example.playaplan.app'] };
      expect(actualResult).toEqual(expectedResult);
      expect(service.sendNotification).toHaveBeenCalledTimes(1);
    });

    it('should trim and send to comma-separated recipients individually', async () => {
      const inputEmail = ' alice@example.playaplan.app , bob@example.playaplan.app ';
      jest.spyOn(service, 'sendNotification')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const actualResult = await service.sendTestEmail(inputEmail, mockTestEmailDetails, inputUserId);

      const expectedRecipients = ['alice@example.playaplan.app', 'bob@example.playaplan.app'];
      expect(actualResult).toEqual({ success: true, recipients: expectedRecipients });
      expect(service.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('should return success false on partial failure', async () => {
      const inputEmail = 'ok@example.playaplan.app, fail@example.playaplan.app';
      jest.spyOn(service, 'sendNotification')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const actualResult = await service.sendTestEmail(inputEmail, mockTestEmailDetails, inputUserId);

      expect(actualResult.success).toBe(false);
      expect(actualResult.recipients).toEqual(['ok@example.playaplan.app', 'fail@example.playaplan.app']);
    });
  });

  describe('sendNotification', () => {
    it('should handle errors gracefully', async () => {
      mockEmailService.sendEmail.mockRejectedValueOnce(new Error('Test error'));

      const result = await service.sendNotification(
        'user@example.playaplan.app',
        NotificationType.EMAIL_VERIFICATION,
        { verificationUrl: 'http://test.com/verify?token=123', userId: 'user-123' },
      );

      expect(result).toBeFalsy();
    });

    it('should send notification successfully', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await service.sendNotification(
        'user@example.playaplan.app',
        NotificationType.EMAIL_VERIFICATION,
        { verificationUrl: 'http://test.com/verify?token=123', userId: 'user-123' },
      );

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          notificationType: NotificationType.EMAIL_VERIFICATION,
          userId: 'user-123',
        }),
      );
    });
  });
}); 
