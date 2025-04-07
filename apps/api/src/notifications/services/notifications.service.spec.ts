import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService, NotificationType } from './notifications.service';
import { EmailService } from './email.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let emailService: EmailService;
  let configService: ConfigService;

  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'app.baseUrl') return 'http://test.com';
      return defaultValue;
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
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    emailService = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await service.sendWelcomeEmail('user@example.com', 'Test User');

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Welcome'),
          html: expect.stringContaining('Test User'),
          text: expect.stringContaining('Test User'),
        }),
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with token', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await service.sendPasswordResetEmail('user@example.com', 'reset-token-123');

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Reset'),
          html: expect.stringContaining('http://test.com/reset-password?token=reset-token-123'),
          text: expect.stringContaining('http://test.com/reset-password?token=reset-token-123'),
        }),
      );
    });
  });

  describe('sendEmailVerificationEmail', () => {
    it('should send email verification with token', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await service.sendEmailVerificationEmail('user@example.com', 'verify-token-123');

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Verify'),
          html: expect.stringContaining('http://test.com/verify-email?token=verify-token-123'),
          text: expect.stringContaining('http://test.com/verify-email?token=verify-token-123'),
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

      const result = await service.sendPaymentConfirmationEmail('user@example.com', paymentDetails);

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Payment'),
          html: expect.stringContaining('payment-123'),
          text: expect.stringContaining('payment-123'),
        }),
      );
    });
  });

  describe('sendShiftConfirmationEmail', () => {
    it('should send shift confirmation email', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const shiftDetails = {
        id: 'shift-123',
        jobName: 'Greeter',
        date: new Date('2023-06-15'),
        startTime: '9:00 AM',
        endTime: '12:00 PM',
        location: 'Main Gate',
      };

      const result = await service.sendShiftConfirmationEmail('user@example.com', shiftDetails);

      expect(result).toBeTruthy();
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Shift'),
          html: expect.stringContaining('Greeter'),
          text: expect.stringContaining('Greeter'),
        }),
      );
    });
  });

  describe('sendNotification', () => {
    it('should handle errors gracefully', async () => {
      mockEmailService.sendEmail.mockRejectedValueOnce(new Error('Test error'));

      const result = await service.sendNotification(
        'user@example.com',
        NotificationType.WELCOME,
        { name: 'Test User' },
      );

      expect(result).toBeFalsy();
    });
  });
}); 