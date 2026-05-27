import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PublicConfigController } from './public-config.controller';
import { CoreConfigService } from '../services/core-config.service';
import { CoreConfig } from '../entities/core-config.entity';

describe('PublicConfigController', () => {
  let controller: PublicConfigController;

  const mockConfig: Partial<CoreConfig> = {
    id: 'test-id',
    campName: 'Test Camp',
    campDescription: 'Test Description',
    homePageBlurb: 'Welcome',
    campBannerUrl: '/banner.png',
    campBannerAltText: 'Banner',
    campIconUrl: '/icon.png',
    campIconAltText: 'Icon',
    registrationYear: 2025,
    earlyRegistrationOpen: false,
    registrationOpen: true,
    registrationTerms: 'Terms text',
    allowDeferredDuesPayment: false,
    applicationApprovalRequired: false,
    stripeEnabled: true,
    stripePublicKey: 'pk_test_123',
    paypalEnabled: false,
    paypalClientId: null,
    paypalMode: 'sandbox',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockCoreConfigService = {
    findCurrent: jest.fn().mockResolvedValue(mockConfig),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicConfigController],
      providers: [
        {
          provide: CoreConfigService,
          useValue: mockCoreConfigService,
        },
      ],
    }).compile();

    controller = module.get<PublicConfigController>(PublicConfigController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPublicConfig', () => {
    it('should return public config with applicationApprovalRequired', async () => {
      const configWithApproval = { ...mockConfig, applicationApprovalRequired: true };
      mockCoreConfigService.findCurrent.mockResolvedValueOnce(configWithApproval);

      const result = await controller.getPublicConfig();

      expect(result.applicationApprovalRequired).toBe(true);
    });

    it('should return applicationApprovalRequired as false when disabled', async () => {
      mockCoreConfigService.findCurrent.mockResolvedValueOnce(mockConfig);

      const result = await controller.getPublicConfig();

      expect(result.applicationApprovalRequired).toBe(false);
    });

    it('should return all expected public fields', async () => {
      mockCoreConfigService.findCurrent.mockResolvedValueOnce(mockConfig);

      const result = await controller.getPublicConfig();

      expect(result.campName).toBe('Test Camp');
      expect(result.registrationYear).toBe(2025);
      expect(result.registrationOpen).toBe(true);
      expect(result.stripeEnabled).toBe(true);
      expect(result.stripePublicKey).toBe('pk_test_123');
      expect(result.allowDeferredDuesPayment).toBe(false);
    });

    it('should throw NotFoundException when config not found', async () => {
      mockCoreConfigService.findCurrent.mockRejectedValueOnce(
        new NotFoundException('Config not found'),
      );

      await expect(controller.getPublicConfig()).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException on unexpected errors', async () => {
      mockCoreConfigService.findCurrent.mockRejectedValueOnce(new Error('DB error'));

      await expect(controller.getPublicConfig()).rejects.toThrow(NotFoundException);
    });
  });
});
