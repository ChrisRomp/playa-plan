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
    campBannerUrl: 'https://example.com/banner.jpg',
    campIconUrl: 'https://example.com/icon.png',
    registrationYear: 2023,
    earlyRegistrationOpen: false,
    registrationOpen: true,
    registrationTerms: 'Test Terms',
    allowDeferredDuesPayment: false,
    stripeEnabled: true,
    stripePublicKey: 'pk_test_123',
    stripeApiKey: 'sk_test_123',
    stripeWebhookSecret: 'whsec_123',
    paypalEnabled: false,
    paypalClientId: null,
    paypalClientSecret: null,
    paypalMode: 'sandbox',
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpUsername: 'test@example.com',
    smtpPassword: 'password123',
    smtpUseSsl: false,
    senderEmail: 'noreply@example.com',
    senderName: 'Test Camp',
    timeZone: 'America/Los_Angeles',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const updatedCoreConfig = {
    ...mockCoreConfig,
    campName: 'Updated Camp',
    registrationYear: 2024,
  };

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
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
      campBannerUrl: 'https://example.com/banner.jpg',
      campIconUrl: 'https://example.com/icon.png',
      registrationYear: 2023,
      earlyRegistrationOpen: false,
      registrationOpen: true,
      registrationTerms: 'Test Terms',
      allowDeferredDuesPayment: false,
      stripeEnabled: true,
      stripePublicKey: 'pk_test_123',
      stripeApiKey: 'sk_test_123',
      stripeWebhookSecret: 'whsec_123',
      paypalEnabled: false,
      timeZone: 'America/Los_Angeles',
    };

    it('should create a new core configuration when none exists', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([]);
      mockPrismaService.$queryRawUnsafe.mockResolvedValueOnce([mockCoreConfig]);
      
      const result = await service.create(createDto);
      
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfig);
    });

    it('should throw BadRequestException if configs already exist', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([mockCoreConfig]);
      
      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should throw BadRequestException if creation fails', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([]);
      mockPrismaService.$queryRawUnsafe.mockResolvedValueOnce([]); // Return empty array instead of null
      
      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all configurations', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([mockCoreConfig]);
      
      const result = await service.findAll();
      
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(CoreConfig);
    });

    it('should return empty array if no configs found', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Database error'));
      
      const result = await service.findAll();
      
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findCurrent', () => {
    it('should return the current configuration', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([mockCoreConfig]);
      
      const result = await service.findCurrent();
      
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfig);
    });

    it('should throw NotFoundException if no configs found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([]);
      
      await expect(service.findCurrent()).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a specific configuration by ID', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([mockCoreConfig]);
      
      const result = await service.findOne(mockCoreConfig.id as string);
      
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfig);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([]);
      
      await expect(service.findOne('not-found-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateDto: UpdateCoreConfigDto = {
      campName: 'Updated Camp',
      registrationYear: 2024,
    };

    it('should update a configuration', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([mockCoreConfig]);
      mockPrismaService.$queryRawUnsafe.mockResolvedValueOnce([updatedCoreConfig]);
      
      const result = await service.update(mockCoreConfig.id as string, updateDto);
      
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfig);
      expect(result.campName).toEqual('Updated Camp');
      expect(result.registrationYear).toEqual(2024);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([]);
      
      await expect(service.update('not-found-id', updateDto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should throw BadRequestException if update fails', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([mockCoreConfig]);
      mockPrismaService.$queryRawUnsafe.mockRejectedValueOnce(new Error('Database error'));
      
      await expect(service.update(mockCoreConfig.id as string, updateDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a configuration', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([mockCoreConfig])
                               .mockResolvedValueOnce([mockCoreConfig]);
      
      const result = await service.remove(mockCoreConfig.id as string);
      
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);
      expect(result).toBeInstanceOf(CoreConfig);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([]);
      
      await expect(service.remove('not-found-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should throw NotFoundException if deletion fails', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([mockCoreConfig])
                               .mockResolvedValueOnce([]);
      
      await expect(service.remove(mockCoreConfig.id as string)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('adminTest', () => {
    it('should return a test message', () => {
      const result = service.adminTest();
      
      expect(result).toEqual('Core Config module is working!');
    });
  });
}); 