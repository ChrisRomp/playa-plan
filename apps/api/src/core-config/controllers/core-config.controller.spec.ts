import { Test, TestingModule } from '@nestjs/testing';
import { CoreConfigController } from './core-config.controller';
import { CoreConfigService } from '../services/core-config.service';
import { CreateCoreConfigDto, UpdateCoreConfigDto, CoreConfigResponseDto } from '../dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CoreConfig } from '../entities/core-config.entity';

describe('CoreConfigController', () => {
  let controller: CoreConfigController;
  let service: CoreConfigService;

  const mockCoreConfig: Partial<CoreConfig> = {
    id: 'test-id',
    campName: 'Test Camp',
    campDescription: 'Test Description',
    homePageBlurb: 'Test Blurb',
    campBannerUrl: 'https://example.playaplan.app/banner.jpg',
    campIconUrl: 'https://example.playaplan.app/icon.png',
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
    smtpHost: 'smtp.example.playaplan.app',
    smtpPort: 587,
    smtpUsername: 'test@example.playaplan.app',
    smtpPassword: 'password123',
    smtpUseSsl: false,
    senderEmail: 'noreply@example.playaplan.app',
    senderName: 'Test Camp',
    timeZone: 'America/Los_Angeles',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateConfigDto: CreateCoreConfigDto = {
    campName: 'Test Camp',
    campDescription: 'Test Description',
    homePageBlurb: 'Test Blurb',
    campBannerUrl: 'https://example.playaplan.app/banner.jpg',
    campIconUrl: 'https://example.playaplan.app/icon.png',
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
    paypalClientId: undefined,
    paypalClientSecret: undefined,
    paypalMode: 'sandbox',
    smtpHost: 'smtp.example.playaplan.app',
    smtpPort: 587,
    smtpUsername: 'test@example.playaplan.app',
    smtpPassword: 'password123',
    smtpUseSsl: false,
    senderEmail: 'noreply@example.playaplan.app',
    senderName: 'Test Camp',
    timeZone: 'America/Los_Angeles',
  };

  const mockUpdateConfigDto: UpdateCoreConfigDto = {
    campName: 'Updated Camp Name',
    registrationYear: 2024,
  };

  const mockCoreConfigService = {
    create: jest.fn().mockResolvedValue(mockCoreConfig),
    findAll: jest.fn().mockResolvedValue([mockCoreConfig]),
    findCurrent: jest.fn().mockResolvedValue(mockCoreConfig),
    findOne: jest.fn().mockResolvedValue(mockCoreConfig),
    update: jest.fn().mockResolvedValue({ ...mockCoreConfig, ...mockUpdateConfigDto }),
    remove: jest.fn().mockResolvedValue(mockCoreConfig),
    adminTest: jest.fn().mockReturnValue('Core Config module is working!'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoreConfigController],
      providers: [
        {
          provide: CoreConfigService,
          useValue: mockCoreConfigService,
        },
      ],
    }).compile();

    controller = module.get<CoreConfigController>(CoreConfigController);
    service = module.get<CoreConfigService>(CoreConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new core configuration', async () => {
      const result = await controller.create(mockCreateConfigDto);
      
      expect(service.create).toHaveBeenCalledWith(mockCreateConfigDto);
      expect(result).toBeInstanceOf(CoreConfigResponseDto);
      expect(result.campName).toEqual(mockCoreConfig.campName);
    });

    it('should throw BadRequestException if service throws', async () => {
      mockCoreConfigService.create.mockRejectedValueOnce(new BadRequestException('Failed to create'));
      
      await expect(controller.create(mockCreateConfigDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findCurrent', () => {
    it('should return the current configuration', async () => {
      const result = await controller.findCurrent();
      
      expect(service.findCurrent).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfigResponseDto);
      expect(result.campName).toEqual(mockCoreConfig.campName);
    });

    it('should throw NotFoundException if no current config found', async () => {
      mockCoreConfigService.findCurrent.mockRejectedValueOnce(new NotFoundException('Config not found'));
      
      await expect(controller.findCurrent()).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all configurations', async () => {
      const result = await controller.findAll();
      
      expect(service.findAll).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toBeInstanceOf(CoreConfigResponseDto);
      expect(result[0].campName).toEqual(mockCoreConfig.campName);
    });
  });

  describe('findOne', () => {
    it('should return a specific configuration by ID', async () => {
      const result = await controller.findOne('test-id');
      
      expect(service.findOne).toHaveBeenCalledWith('test-id');
      expect(result).toBeInstanceOf(CoreConfigResponseDto);
      expect(result.campName).toEqual(mockCoreConfig.campName);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockCoreConfigService.findOne.mockRejectedValueOnce(new NotFoundException('Config not found'));
      
      await expect(controller.findOne('not-found-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a configuration', async () => {
      const result = await controller.update('test-id', mockUpdateConfigDto);
      
      expect(service.update).toHaveBeenCalledWith('test-id', mockUpdateConfigDto);
      expect(result).toBeInstanceOf(CoreConfigResponseDto);
      expect(result.campName).toEqual(mockUpdateConfigDto.campName);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockCoreConfigService.update.mockRejectedValueOnce(new NotFoundException('Config not found'));
      
      await expect(controller.update('not-found-id', mockUpdateConfigDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if update fails', async () => {
      mockCoreConfigService.update.mockRejectedValueOnce(new BadRequestException('Update failed'));
      
      await expect(controller.update('test-id', mockUpdateConfigDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateCurrent', () => {
    it('should update the current configuration', async () => {
      const result = await controller.updateCurrent(mockUpdateConfigDto);
      
      expect(service.findCurrent).toHaveBeenCalledWith(false);
      expect(service.update).toHaveBeenCalledWith(mockCoreConfig.id, mockUpdateConfigDto);
      expect(result).toBeInstanceOf(CoreConfigResponseDto);
      expect(result.campName).toEqual(mockUpdateConfigDto.campName);
    });

    it('should create a new configuration if none exists', async () => {
      // Mock the findCurrent to throw NotFoundException
      mockCoreConfigService.findCurrent.mockRejectedValueOnce(new NotFoundException('Config not found'));
      
      const result = await controller.updateCurrent(mockUpdateConfigDto);
      
      expect(service.findCurrent).toHaveBeenCalledWith(false);
      expect(service.create).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CoreConfigResponseDto);
    });

    it('should throw BadRequestException if campName is missing when creating', async () => {
      // Mock the findCurrent to throw NotFoundException
      mockCoreConfigService.findCurrent.mockRejectedValueOnce(new NotFoundException('Config not found'));
      
      // Create an update DTO without campName
      const dtoBadCreate = { ...mockUpdateConfigDto };
      delete dtoBadCreate.campName;
      
      await expect(controller.updateCurrent(dtoBadCreate)).rejects.toThrow(BadRequestException);
      expect(service.findCurrent).toHaveBeenCalledWith(false);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if update/create fails', async () => {
      mockCoreConfigService.update.mockRejectedValueOnce(new BadRequestException('Update failed'));
      
      await expect(controller.updateCurrent(mockUpdateConfigDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a configuration', async () => {
      const result = await controller.remove('test-id');
      
      expect(service.remove).toHaveBeenCalledWith('test-id');
      expect(result).toBeInstanceOf(CoreConfigResponseDto);
      expect(result.campName).toEqual(mockCoreConfig.campName);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockCoreConfigService.remove.mockRejectedValueOnce(new NotFoundException('Config not found'));
      
      await expect(controller.remove('not-found-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if deletion fails', async () => {
      mockCoreConfigService.remove.mockRejectedValueOnce(new BadRequestException('Deletion failed'));
      
      await expect(controller.remove('test-id')).rejects.toThrow(BadRequestException);
    });
  });

  describe('adminTest', () => {
    it('should return a test message', () => {
      const result = controller.adminTest();
      expect(service.adminTest).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Core Config module is working!' });
    });
  });
});