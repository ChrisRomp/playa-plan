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
        'user-123'
      );

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.playaplan.app',
          subject: expect.stringContaining('Registration'),
          html: expect.stringContaining('registration-123'),
          text: expect.stringContaining('registration-123'),
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