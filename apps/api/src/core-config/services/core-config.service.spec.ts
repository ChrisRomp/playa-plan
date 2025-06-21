import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CoreConfigService } from './core-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCoreConfigDto, UpdateCoreConfigDto } from '../dto';
import { CoreConfig } from '../entities/core-config.entity';

describe('CoreConfigService', () => {
  let service: CoreConfigService;
  let prismaService: PrismaService;

  // Mock configuration for testing
  const mockCoreConfig: Partial<CoreConfig> = {
    id: 'test-id',
    campName: 'Test Camp',
    campDescription: 'Test Description',
    homePageBlurb: 'Test Blurb',
    campBannerUrl: 'https://mycamp.playaplan.app/banner.jpg',
    campIconUrl: 'https://mycamp.playaplan.app/icon.png',
    registrationYear: 2023,
    earlyRegistrationOpen: false,
    registrationOpen: true,
    registrationTerms: 'Test Terms',
    allowDeferredDuesPayment: false,
    stripeEnabled: true,
    stripePublicKey: 'pk_test_123',
    stripeApiKey: 'sk_test_123',
    paypalEnabled: false,
    paypalClientId: null,
    paypalClientSecret: null,
    paypalMode: 'sandbox',
    smtpHost: 'smtp.mycamp.playaplan.app',
    smtpPort: 587,
    smtpUsername: 'test@example.playaplan.app',
    smtpPassword: 'password123',
    smtpUseSsl: false,
    senderEmail: 'noreply@example.playaplan.app',
    senderName: 'Test Camp',
    replyToEmail: null,
    emailEnabled: false,
    timeZone: 'America/Los_Angeles',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const updatedCoreConfig = {
    ...mockCoreConfig,
    campName: 'Updated Camp',
    registrationYear: 2024,
  };

  // Create a more complete mock
  const mockPrismaService = {
    coreConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoreConfigService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CoreConfigService>(CoreConfigService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mock calls before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateCoreConfigDto = {
      campName: 'Test Camp',
      campDescription: 'Test Description',
      homePageBlurb: 'Test Blurb',
      campBannerUrl: 'https://mycamp.playaplan.app/banner.jpg',
      campIconUrl: 'https://mycamp.playaplan.app/icon.png',
      registrationYear: 2023,
      earlyRegistrationOpen: false,
      registrationOpen: true,
      registrationTerms: 'Test Terms',
      allowDeferredDuesPayment: false,
      stripeEnabled: true,
      stripePublicKey: 'pk_test_123',
      stripeApiKey: 'sk_test_123',
      paypalEnabled: false,
      timeZone: 'America/Los_Angeles',
    };

    it('should create a new core configuration when none exists', async () => {
      mockPrismaService.coreConfig.findMany.mockResolvedValueOnce([]);
      mockPrismaService.coreConfig.create.mockResolvedValueOnce(mockCoreConfig);
      
      const result = await service.create(createDto);
      
      expect(mockPrismaService.coreConfig.findMany).toHaveBeenCalled();
      expect(mockPrismaService.coreConfig.create).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfig);
    });

    it('should throw BadRequestException if configs already exist', async () => {
      mockPrismaService.coreConfig.findMany.mockResolvedValueOnce([mockCoreConfig]);
      
      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.coreConfig.findMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException if creation fails', async () => {
      mockPrismaService.coreConfig.findMany.mockResolvedValueOnce([]);
      mockPrismaService.coreConfig.create.mockRejectedValueOnce(new Error('Database error'));
      
      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.coreConfig.findMany).toHaveBeenCalled();
      expect(mockPrismaService.coreConfig.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all configurations', async () => {
      mockPrismaService.coreConfig.findMany.mockResolvedValueOnce([mockCoreConfig]);
      
      const result = await service.findAll();
      
      expect(mockPrismaService.coreConfig.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(CoreConfig);
    });

    it('should return empty array if no configs found', async () => {
      mockPrismaService.coreConfig.findMany.mockRejectedValueOnce(new Error('Database error'));
      
      const result = await service.findAll();
      
      expect(mockPrismaService.coreConfig.findMany).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findCurrent', () => {
    it('should return the current configuration', async () => {
      mockPrismaService.coreConfig.findMany.mockResolvedValueOnce([mockCoreConfig]);
      
      const result = await service.findCurrent();
      
      expect(mockPrismaService.coreConfig.findMany).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfig);
    });

    it('should return a default configuration if no configs found', async () => {
      mockPrismaService.coreConfig.findMany.mockResolvedValueOnce([]);
      
      const result = await service.findCurrent();
      
      // Verify the result is a default configuration
      expect(result).toBeDefined();
      expect(result.id).toBe('default');
      expect(result.campName).toBe('PlayaPlan');
      expect(result.registrationYear).toBe(new Date().getFullYear());
      expect(mockPrismaService.coreConfig.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a specific configuration by ID', async () => {
      mockPrismaService.coreConfig.findUnique.mockResolvedValueOnce(mockCoreConfig);
      
      const result = await service.findOne(mockCoreConfig.id as string);
      
      expect(mockPrismaService.coreConfig.findUnique).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfig);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockPrismaService.coreConfig.findUnique.mockResolvedValueOnce(null);
      
      await expect(service.findOne('not-found-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.coreConfig.findUnique).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateDto: UpdateCoreConfigDto = {
      campName: 'Updated Camp',
      registrationYear: 2024,
    };

    it('should update a configuration', async () => {
      mockPrismaService.coreConfig.findUnique.mockResolvedValueOnce(mockCoreConfig);
      mockPrismaService.coreConfig.update.mockResolvedValueOnce(updatedCoreConfig);
      
      const result = await service.update(mockCoreConfig.id as string, updateDto);
      
      expect(mockPrismaService.coreConfig.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.coreConfig.update).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfig);
      expect(result.campName).toEqual('Updated Camp');
    });

    it('should update email configuration including replyToEmail field', async () => {
      const emailUpdateDto: UpdateCoreConfigDto = {
        senderEmail: 'new-sender@example.com',
        senderName: 'New Sender Name',
        replyToEmail: 'replies@example.com',
        emailEnabled: true,
      };

      const mockUpdatedConfig = {
        ...mockCoreConfig,
        senderEmail: 'new-sender@example.com',
        senderName: 'New Sender Name',
        replyToEmail: 'replies@example.com',
        emailEnabled: true,
        updatedAt: new Date(),
      };

      mockPrismaService.coreConfig.findUnique.mockResolvedValueOnce(mockCoreConfig);
      mockPrismaService.coreConfig.update.mockResolvedValueOnce(mockUpdatedConfig);
      
      const result = await service.update(mockCoreConfig.id as string, emailUpdateDto);
      
      expect(mockPrismaService.coreConfig.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.coreConfig.update).toHaveBeenCalledWith({
        where: { id: mockCoreConfig.id },
        data: expect.objectContaining({
          senderEmail: 'new-sender@example.com',
          senderName: 'New Sender Name',
          replyToEmail: 'replies@example.com',
          emailEnabled: true,
          updatedAt: expect.any(Date),
        }),
      });
      expect(result).toBeInstanceOf(CoreConfig);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockPrismaService.coreConfig.findUnique.mockResolvedValueOnce(null);
      
      await expect(service.update('not-found-id', updateDto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.coreConfig.findUnique).toHaveBeenCalled();
    });

    it('should throw BadRequestException if update fails', async () => {
      mockPrismaService.coreConfig.findUnique.mockResolvedValueOnce(mockCoreConfig);
      mockPrismaService.coreConfig.update.mockRejectedValueOnce(new Error('Database error'));
      
      await expect(service.update(mockCoreConfig.id as string, updateDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.coreConfig.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.coreConfig.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a configuration', async () => {
      mockPrismaService.coreConfig.findUnique.mockResolvedValueOnce(mockCoreConfig);
      mockPrismaService.coreConfig.delete.mockResolvedValueOnce(mockCoreConfig);
      
      const result = await service.remove(mockCoreConfig.id as string);
      
      expect(mockPrismaService.coreConfig.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.coreConfig.delete).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfig);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockPrismaService.coreConfig.findUnique.mockResolvedValueOnce(null);
      
      await expect(service.remove('not-found-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.coreConfig.findUnique).toHaveBeenCalled();
    });

    it('should throw BadRequestException if deletion fails', async () => {
      mockPrismaService.coreConfig.findUnique.mockResolvedValueOnce(mockCoreConfig);
      mockPrismaService.coreConfig.delete.mockRejectedValueOnce(new Error('Database error'));
      
      await expect(service.remove(mockCoreConfig.id as string)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.coreConfig.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.coreConfig.delete).toHaveBeenCalled();
    });
  });

  describe('getEmailConfiguration', () => {
    it('should return all email config fields from database', async () => {
      // Arrange
      const configWithEmail = {
        ...mockCoreConfig,
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUser: 'test@example.com', // Database field name
        smtpPassword: 'password123',
        smtpSecure: false, // Database field name
        senderEmail: 'noreply@test.com',
        senderName: 'Test Camp',
      };
      mockPrismaService.coreConfig.findMany.mockResolvedValueOnce([configWithEmail]);

      // Act
      const result = await service.getEmailConfiguration();

      // Assert
      expect(result).toEqual({
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com', // Entity field name
        smtpPassword: 'password123',
        smtpUseSsl: false, // Entity field name
        senderEmail: 'noreply@test.com',
        senderName: 'Test Camp',
        replyToEmail: null,
      });
      expect(mockPrismaService.coreConfig.findMany).toHaveBeenCalled();
    });

    it('should return safe defaults on database error', async () => {
      // Arrange
      mockPrismaService.coreConfig.findMany.mockRejectedValueOnce(new Error('Database error'));

      // Act
      const result = await service.getEmailConfiguration();

      // Assert
      expect(result).toEqual({
        emailEnabled: false,
        smtpHost: null,
        smtpPort: null,
        smtpUsername: null,
        smtpPassword: null,
        smtpUseSsl: false,
        senderEmail: null,
        senderName: null,
        replyToEmail: null,
      });
      expect(mockPrismaService.coreConfig.findMany).toHaveBeenCalled();
    });

    it('should handle missing configuration gracefully', async () => {
      // Arrange - Return empty array to trigger default config behavior
      mockPrismaService.coreConfig.findMany.mockResolvedValueOnce([]);

      // Act
      const result = await service.getEmailConfiguration();

      // Assert - Should return default config values (emailEnabled: false)
      expect(result).toEqual({
        emailEnabled: false,
        smtpHost: null,
        smtpPort: null,
        smtpUsername: null,
        smtpPassword: null,
        smtpUseSsl: false,
        senderEmail: null,
        senderName: null,
        replyToEmail: null,
      });
      expect(mockPrismaService.coreConfig.findMany).toHaveBeenCalled();
    });

    it('should handle email configuration field mapping between entity and database', async () => {
      // Arrange - Test the DB field mapping (smtpUser -> smtpUsername, smtpSecure -> smtpUseSsl)
      const dbConfig = {
        ...mockCoreConfig,
        emailEnabled: true,
        smtpHost: 'smtp.mapped.com',
        smtpPort: 465,
        smtpUser: 'mapped@example.com', // DB field name
        smtpPassword: 'mappedpass',
        smtpSecure: true, // DB field name (boolean)
        senderEmail: 'sender@mapped.com',
        senderName: 'Mapped Camp',
      };
      
      // Mock what Prisma returns (database field names)
      mockPrismaService.coreConfig.findMany.mockResolvedValueOnce([dbConfig]);

      // Act
      const result = await service.getEmailConfiguration();

      // Assert - Should return entity field names
      expect(result).toEqual({
        emailEnabled: true,
        smtpHost: 'smtp.mapped.com',
        smtpPort: 465,
        smtpUsername: 'mapped@example.com', // Entity field name
        smtpPassword: 'mappedpass',
        smtpUseSsl: true, // Entity field name
        senderEmail: 'sender@mapped.com',
        senderName: 'Mapped Camp',
        replyToEmail: null,
      });
    });
  });

  describe('adminTest', () => {
    it('should return a test message', () => {
      const result = service.adminTest();
      
      expect(result).toEqual('Core Config module is working!');
    });
  });
});