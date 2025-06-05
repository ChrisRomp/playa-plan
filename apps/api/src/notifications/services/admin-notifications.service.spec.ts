import { Test, TestingModule } from '@nestjs/testing';
import { AdminNotificationsService, AdminNotificationData } from './admin-notifications.service';
import { NotificationsService, TemplateData } from './notifications.service';
import { EmailAuditService } from './email-audit.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { CoreConfig } from '../../core-config/entities/core-config.entity';
import { NotificationType, RegistrationStatus } from '@prisma/client';

describe('AdminNotificationsService', () => {
  let service: AdminNotificationsService;
  let notificationsService: jest.Mocked<NotificationsService>;
  let emailAuditService: jest.Mocked<EmailAuditService>;
  let coreConfigService: jest.Mocked<CoreConfigService>;

  const mockAdminUser = {
    id: 'admin-123',
    firstName: 'Jane',
    lastName: 'Admin',
    email: 'admin@example.com',
  };

  const mockTargetUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    playaName: 'TestBurner',
  };

  const mockRegistration = {
    id: 'reg-123',
    year: 2024,
    status: RegistrationStatus.CONFIRMED,
    campingOptions: [
      {
        name: 'RV Spot',
        description: 'Standard RV parking space',
      },
    ],
    jobs: [
      {
        name: 'Gate Guard',
        category: 'Security',
        shift: {
          name: 'Evening Shift',
          startTime: '18:00',
          endTime: '06:00',
          dayOfWeek: 'FRIDAY',
        },
        location: 'Main Gate',
      },
    ],
  };

  const mockCoreConfig: Partial<CoreConfig> = {
    id: 'config-1',
    campName: 'Burning Test',
  };

  beforeEach(async () => {
    const mockNotificationsService = {
      sendNotification: jest.fn(),
    };

    const mockEmailAuditService = {
      logEmailSent: jest.fn(),
      logEmailFailed: jest.fn(),
    };

    const mockCoreConfigService = {
      findCurrent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminNotificationsService,
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: EmailAuditService, useValue: mockEmailAuditService },
        { provide: CoreConfigService, useValue: mockCoreConfigService },
      ],
    }).compile();

    service = module.get<AdminNotificationsService>(AdminNotificationsService);
    notificationsService = module.get(NotificationsService);
    emailAuditService = module.get(EmailAuditService);
    coreConfigService = module.get(CoreConfigService);

    // Mock logger to avoid console output during tests
    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendRegistrationModificationNotification', () => {
    // Task 5.5.1: Test sendRegistrationModificationNotification() uses correct template and format
    it('should send registration modification notification with correct template and format', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: mockRegistration,
        reason: 'Adding camping option per user request',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);
      emailAuditService.logEmailSent.mockResolvedValue();

      const result = await service.sendRegistrationModificationNotification(notificationData);

      expect(result).toBe(true);
      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        'john.doe@example.com',
        NotificationType.REGISTRATION_CONFIRMATION,
        expect.objectContaining({
          name: 'John',
          playaName: 'TestBurner',
          campName: 'Burning Test',
          userId: 'user-123',
          registrationDetails: {
            id: 'reg-123',
            year: 2024,
            status: RegistrationStatus.CONFIRMED,
            campingOptions: mockRegistration.campingOptions,
            jobs: mockRegistration.jobs,
          },
          adminInfo: {
            name: 'Jane Admin',
            email: 'admin@example.com',
            reason: 'Adding camping option per user request',
          },
        }),
      );
    });

    // Task 5.5.3: Test notification toggle respects user preferences (default disabled)
    it('should use registration confirmation template for modifications', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: mockRegistration,
        reason: 'Status updated by admin',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);

      await service.sendRegistrationModificationNotification(notificationData);

      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        expect.any(String),
        NotificationType.REGISTRATION_CONFIRMATION,
        expect.any(Object),
      );
    });

    // Task 5.5.5: Test notifications include current registration status and admin contact info
    it('should include current registration status and admin contact info', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: {
          ...mockRegistration,
          status: RegistrationStatus.WAITLISTED,
        },
        reason: 'Updated to waitlist due to capacity',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);

      await service.sendRegistrationModificationNotification(notificationData);

      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      
      expect(templateData.registrationDetails?.status).toBe(RegistrationStatus.WAITLISTED);
      expect(templateData.adminInfo).toEqual({
        name: 'Jane Admin',
        email: 'admin@example.com',
        reason: 'Updated to waitlist due to capacity',
      });
    });

    // Task 5.5.6: Test modification notifications exclude dues information for admin changes
    it('should not include dues information in modification notifications', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: mockRegistration,
        reason: 'Administrative update',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);

      await service.sendRegistrationModificationNotification(notificationData);

      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      
      expect(templateData.registrationDetails?.totalCost).toBeUndefined();
      expect(templateData.registrationDetails?.currency).toBeUndefined();
    });

    it('should handle user without playa name', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: {
          ...mockTargetUser,
          playaName: undefined,
        },
        registration: mockRegistration,
        reason: 'Test modification',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);

      const result = await service.sendRegistrationModificationNotification(notificationData);

      expect(result).toBe(true);
      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      expect(templateData.playaName).toBeUndefined();
    });

    it('should use fallback camp name when config fails', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: mockRegistration,
        reason: 'Test with fallback camp name',
      };

      coreConfigService.findCurrent.mockRejectedValue(new Error('Config not found'));
      notificationsService.sendNotification.mockResolvedValue(true);

      await service.sendRegistrationModificationNotification(notificationData);

      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      expect(templateData.campName).toBe('PlayaPlan');
    });

    // Task 5.5.4: Test notification failures don't block main registration operations
    it('should handle notification failures gracefully and log attempts', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: mockRegistration,
        reason: 'Test notification failure',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockRejectedValue(new Error('SMTP server unavailable'));
      emailAuditService.logEmailFailed.mockResolvedValue();

      const result = await service.sendRegistrationModificationNotification(notificationData);

      expect(result).toBe(false);
      expect(emailAuditService.logEmailFailed).toHaveBeenCalledWith(
        'john.doe@example.com',
        'Admin REGISTRATION_CONFIRMATION Notification',
        NotificationType.REGISTRATION_CONFIRMATION,
        'SMTP server unavailable',
        'user-123',
      );
    });

    it('should log successful notification attempts', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: mockRegistration,
        reason: 'Test successful notification',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);
      emailAuditService.logEmailSent.mockResolvedValue();

      await service.sendRegistrationModificationNotification(notificationData);

      expect(emailAuditService.logEmailSent).toHaveBeenCalledWith(
        'john.doe@example.com',
        'Admin REGISTRATION_CONFIRMATION Notification',
        NotificationType.REGISTRATION_CONFIRMATION,
        'user-123',
      );
    });
  });

  describe('sendRegistrationCancellationNotification', () => {
    // Task 5.5.2: Test sendRegistrationCancellationNotification() sends simple cancellation notice
    it('should send simple cancellation notice with custom template', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: {
          ...mockRegistration,
          status: 'CANCELLED',
        },
        reason: 'User requested cancellation',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);
      emailAuditService.logEmailSent.mockResolvedValue();

      const result = await service.sendRegistrationCancellationNotification(notificationData);

      expect(result).toBe(true);
      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        'john.doe@example.com',
        NotificationType.REGISTRATION_ERROR,
        expect.objectContaining({
          customSubject: 'Registration Cancelled - Burning Test 2024',
          customText: expect.stringContaining('your registration for Burning Test 2024 has been cancelled'),
          customHtml: expect.stringContaining('Registration Cancelled'),
        }),
      );
    });

    // Task 5.5.7: Test cancellation notifications use generic "contact us" instead of admin email
    it('should use generic contact message instead of admin email', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: {
          ...mockRegistration,
          status: 'CANCELLED',
        },
        reason: 'Duplicate registration found',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);

      await service.sendRegistrationCancellationNotification(notificationData);

      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      expect(templateData.customText).toContain('please contact us');
      expect(templateData.customText).not.toContain('admin@example.com');
      expect(templateData.customHtml).toContain('please contact us');
      expect(templateData.customHtml).not.toContain('admin@example.com');
    });

    // Task 5.5.8: Test cancellation notifications include refund amount when processed automatically
    it('should include refund information when refund is processed', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: {
          ...mockRegistration,
          status: 'CANCELLED',
        },
        reason: 'Automatic cancellation due to payment failure',
        refundInfo: {
          amount: 15000, // $150.00 in cents
          currency: 'USD',
          processed: true,
        },
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);

      await service.sendRegistrationCancellationNotification(notificationData);

      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      expect(templateData.customText).toContain('A refund of $150.00 has been processed');
      expect(templateData.customText).toContain('within 5-10 business days');
      expect(templateData.customHtml).toContain('A refund of $150.00 has been processed');
      expect(templateData.customHtml).toContain('Refund Information');
    });

    it('should not include refund information when no refund is processed', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: {
          ...mockRegistration,
          status: 'CANCELLED',
        },
        reason: 'Cancellation due to policy violation',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);

      await service.sendRegistrationCancellationNotification(notificationData);

      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      expect(templateData.customText).not.toContain('A refund of');
      expect(templateData.customText).not.toContain('has been processed');
      expect(templateData.customHtml).not.toContain('Refund Information');
    });

    it('should handle users without playa names in greeting', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: {
          ...mockTargetUser,
          firstName: 'User',
          playaName: undefined,
        },
        registration: {
          ...mockRegistration,
          status: 'CANCELLED',
        },
        reason: 'Test cancellation without names',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);

      const result = await service.sendRegistrationCancellationNotification(notificationData);

      expect(result).toBe(true);
      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      expect(templateData.customText).toContain('Hi User,');
    });

    it('should use fallback camp name for cancellation notifications', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: {
          ...mockRegistration,
          status: 'CANCELLED',
        },
        reason: 'Test with fallback camp name',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      coreConfigService.findCurrent.mockResolvedValue(null as any);
      notificationsService.sendNotification.mockResolvedValue(true);

      await service.sendRegistrationCancellationNotification(notificationData);

      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      expect(templateData.customSubject).toContain('PlayaPlan 2024');
    });

    it('should log cancellation notification attempts', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: {
          ...mockRegistration,
          status: 'CANCELLED',
        },
        reason: 'Test logging',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);
      emailAuditService.logEmailSent.mockResolvedValue();

      await service.sendRegistrationCancellationNotification(notificationData);

      expect(emailAuditService.logEmailSent).toHaveBeenCalledWith(
        'john.doe@example.com',
        'Admin REGISTRATION_ERROR Notification',
        NotificationType.REGISTRATION_ERROR,
        'user-123',
      );
    });

    it('should handle cancellation notification failures', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: {
          ...mockRegistration,
          status: 'CANCELLED',
        },
        reason: 'Test failure handling',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockRejectedValue(new Error('Email service down'));
      emailAuditService.logEmailFailed.mockResolvedValue();

      const result = await service.sendRegistrationCancellationNotification(notificationData);

      expect(result).toBe(false);
      expect(emailAuditService.logEmailFailed).toHaveBeenCalledWith(
        'john.doe@example.com',
        'Admin REGISTRATION_ERROR Notification',
        NotificationType.REGISTRATION_ERROR,
        'Email service down',
        'user-123',
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle logging failures gracefully', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: mockRegistration,
        reason: 'Test logging failure',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);
      emailAuditService.logEmailSent.mockRejectedValue(new Error('Audit service down'));

      // Should not throw error even if logging fails
      const result = await service.sendRegistrationModificationNotification(notificationData);
      expect(result).toBe(true);
    });

    it('should handle unknown errors during notification sending', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: mockRegistration,
        reason: 'Test unknown error',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockRejectedValue('Unknown error type');
      emailAuditService.logEmailFailed.mockResolvedValue();

      const result = await service.sendRegistrationModificationNotification(notificationData);

      expect(result).toBe(false);
      expect(emailAuditService.logEmailFailed).toHaveBeenCalledWith(
        'john.doe@example.com',
        'Admin REGISTRATION_CONFIRMATION Notification',
        NotificationType.REGISTRATION_CONFIRMATION,
        'Unknown error',
        'user-123',
      );
    });

    it('should handle errors during camp name retrieval', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: mockRegistration,
        reason: 'Test camp name error',
      };

      coreConfigService.findCurrent.mockRejectedValue(new Error('Database connection failed'));
      notificationsService.sendNotification.mockResolvedValue(true);

      const result = await service.sendRegistrationModificationNotification(notificationData);

      expect(result).toBe(true);
      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      expect(templateData.campName).toBe('PlayaPlan');
    });
  });

  describe('Template Content Validation', () => {
    it('should generate proper greeting for users with both first name and playa name', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: {
          ...mockRegistration,
          status: 'CANCELLED',
        },
        reason: 'Test greeting generation',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);

      await service.sendRegistrationCancellationNotification(notificationData);

      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      expect(templateData.customText).toContain('Hi John (TestBurner),');
    });

    it('should format registration details correctly in cancellation email', async () => {
      const notificationData: AdminNotificationData = {
        adminUser: mockAdminUser,
        targetUser: mockTargetUser,
        registration: {
          id: 'reg-456',
          year: 2025,
          status: 'CANCELLED',
        },
        reason: 'Event cancelled',
      };

      coreConfigService.findCurrent.mockResolvedValue(mockCoreConfig as CoreConfig);
      notificationsService.sendNotification.mockResolvedValue(true);

      await service.sendRegistrationCancellationNotification(notificationData);

      const [, , templateData] = notificationsService.sendNotification.mock.calls[0] as [string, NotificationType, TemplateData];
      expect(templateData.customText).toContain('Registration ID: reg-456');
      expect(templateData.customText).toContain('Year: 2025');
      expect(templateData.customText).toContain('Status: Cancelled');
      expect(templateData.customHtml).toContain('Registration ID:</strong> reg-456');
      expect(templateData.customHtml).toContain('Year:</strong> 2025');
    });
  });
}); 