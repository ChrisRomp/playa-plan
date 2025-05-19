import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService, EmailOptions } from './email.service';
import * as sgMail from '@sendgrid/mail';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'email.defaultFrom') return 'test@example.playaplan.app';
      if (key === 'email.provider') return 'sendgrid';
      if (key === 'email.sendgrid.apiKey') return 'test_api_key';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize SendGrid with API key', () => {
    expect(sgMail.setApiKey).toHaveBeenCalledWith('test_api_key');
  });

  describe('sendEmail', () => {
    it('should send email via SendGrid', async () => {
      // Mock successful send
      (sgMail.send as jest.Mock).mockResolvedValueOnce([
        { statusCode: 202 },
        {},
      ]);

      const emailOptions: EmailOptions = {
        to: 'recipient@example.playaplan.app',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = await service.sendEmail(emailOptions);

      expect(result).toBeTruthy();
      expect(sgMail.send).toHaveBeenCalledWith({
        to: 'recipient@example.playaplan.app',
        from: 'test@example.playaplan.app',
        subject: 'Test Email',
        text: '',
        html: '<p>Test content</p>',
        replyTo: 'test@example.playaplan.app',
      });
    });

    it('should send email to multiple recipients', async () => {
      // Mock successful send
      (sgMail.send as jest.Mock).mockResolvedValueOnce([
        { statusCode: 202 },
        {},
      ]);

      const emailOptions: EmailOptions = {
        to: ['recipient1@example.playaplan.app', 'recipient2@example.playaplan.app'],
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = await service.sendEmail(emailOptions);

      expect(result).toBeTruthy();
      expect(sgMail.send).toHaveBeenCalledWith({
        to: ['recipient1@example.playaplan.app', 'recipient2@example.playaplan.app'],
        from: 'test@example.playaplan.app',
        subject: 'Test Email',
        text: '',
        html: '<p>Test content</p>',
        replyTo: 'test@example.playaplan.app',
      });
    });

    it('should handle custom from address', async () => {
      // Mock successful send
      (sgMail.send as jest.Mock).mockResolvedValueOnce([
        { statusCode: 202 },
        {},
      ]);

      const emailOptions: EmailOptions = {
        to: 'recipient@example.playaplan.app',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        from: 'custom@example.playaplan.app',
      };

      const result = await service.sendEmail(emailOptions);

      expect(result).toBeTruthy();
      expect(sgMail.send).toHaveBeenCalledWith({
        to: 'recipient@example.playaplan.app',
        from: 'custom@example.playaplan.app',
        subject: 'Test Email',
        text: '',
        html: '<p>Test content</p>',
        replyTo: 'custom@example.playaplan.app',
      });
    });

    it('should handle custom replyTo address', async () => {
      // Mock successful send
      (sgMail.send as jest.Mock).mockResolvedValueOnce([
        { statusCode: 202 },
        {},
      ]);

      const emailOptions: EmailOptions = {
        to: 'recipient@example.playaplan.app',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        replyTo: 'reply@example.playaplan.app',
      };

      const result = await service.sendEmail(emailOptions);

      expect(result).toBeTruthy();
      expect(sgMail.send).toHaveBeenCalledWith({
        to: 'recipient@example.playaplan.app',
        from: 'test@example.playaplan.app',
        subject: 'Test Email',
        text: '',
        html: '<p>Test content</p>',
        replyTo: 'reply@example.playaplan.app',
      });
    });

    it('should handle plain text content', async () => {
      // Mock successful send
      (sgMail.send as jest.Mock).mockResolvedValueOnce([
        { statusCode: 202 },
        {},
      ]);

      const emailOptions: EmailOptions = {
        to: 'recipient@example.playaplan.app',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
      };

      const result = await service.sendEmail(emailOptions);

      expect(result).toBeTruthy();
      expect(sgMail.send).toHaveBeenCalledWith({
        to: 'recipient@example.playaplan.app',
        from: 'test@example.playaplan.app',
        subject: 'Test Email',
        text: 'Test content',
        html: '<p>Test content</p>',
        replyTo: 'test@example.playaplan.app',
      });
    });

    it('should handle SendGrid error', async () => {
      // Mock error
      (sgMail.send as jest.Mock).mockRejectedValueOnce(new Error('SendGrid error'));

      const emailOptions: EmailOptions = {
        to: 'recipient@example.playaplan.app',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = await service.sendEmail(emailOptions);

      expect(result).toBeFalsy();
    });
  });
}); 