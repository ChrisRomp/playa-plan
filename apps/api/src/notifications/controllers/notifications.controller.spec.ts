import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../services/notifications.service';
import { EmailService } from '../services/email.service';
import { SendEmailDto, SendEmailToMultipleRecipientsDto } from '../dto/send-email.dto';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: NotificationsService;
  let emailService: EmailService;

  const mockNotificationsService = {
    sendWelcomeEmail: jest.fn(),
  };

  const mockEmailService = {
    sendEmail: jest.fn(),
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
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    emailService = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should send an email', async () => {
      const dto: SendEmailDto = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      };

      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await controller.sendEmail(dto);

      expect(result).toEqual({ success: true });
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: undefined,
        attachments: undefined,
      });
    });

    it('should return success: false when email fails', async () => {
      const dto: SendEmailDto = {
        to: 'test@example.com',
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
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Batch Email',
        html: '<p>Batch content</p>',
      };

      mockEmailService.sendEmail.mockResolvedValueOnce(true);

      const result = await controller.sendEmailToMultipleRecipients(dto);

      expect(result).toEqual({ success: true });
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Batch Email',
        html: '<p>Batch content</p>',
        text: undefined,
        attachments: undefined,
      });
    });
  });

  describe('sendTestEmail', () => {
    it('should send a test email', async () => {
      mockNotificationsService.sendWelcomeEmail.mockResolvedValueOnce(true);

      const result = await controller.sendTestEmail('test@example.com');

      expect(result).toEqual({ success: true });
      expect(mockNotificationsService.sendWelcomeEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
      );
    });
  });
}); 