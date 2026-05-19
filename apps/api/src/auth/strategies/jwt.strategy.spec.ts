import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SAFE_USER_SELECT } from '../types/safe-user';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  describe('constructor', () => {
    beforeEach(() => {
      configService = mockConfigService as unknown as ConfigService;
      prismaService = mockPrismaService as unknown as PrismaService;
      jest.clearAllMocks();
    });

    it('should throw an error when jwt.secret is missing', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(undefined);

      // Act & Assert
      expect(() => {
        new JwtStrategy(configService, prismaService);
      }).toThrow('JWT secret is not configured');
    });

    it('should throw an error when jwt.secret is null', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(null);

      // Act & Assert
      expect(() => {
        new JwtStrategy(configService, prismaService);
      }).toThrow('JWT secret is not configured');
    });

    it('should throw an error when jwt.secret is empty string', () => {
      // Arrange
      mockConfigService.get.mockReturnValue('');

      // Act & Assert
      expect(() => {
        new JwtStrategy(configService, prismaService);
      }).toThrow('JWT secret is not configured');
    });

    it('should initialize successfully with valid jwt.secret', () => {
      // Arrange
      mockConfigService.get.mockReturnValue('valid-secret');

      // Act & Assert
      expect(() => {
        strategy = new JwtStrategy(configService, prismaService);
      }).not.toThrow();
      expect(strategy).toBeDefined();
    });
  });

  describe('validate', () => {
    beforeEach(async () => {
      // Create a proper testing module for the validate tests
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('test-secret'),
            },
          },
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          JwtStrategy,
        ],
      }).compile();

      strategy = module.get<JwtStrategy>(JwtStrategy);
      prismaService = module.get<PrismaService>(PrismaService);
      jest.clearAllMocks();
    });

    it('should return only safe user fields via Prisma select', async () => {
      // Arrange
      const payload = { sub: 'user-id', email: 'test@example.com' };
      const mockSafeUser = {
        id: 'user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        playaName: null,
        profilePicture: null,
        role: 'USER',
        isEmailVerified: true,
        phone: null,
        city: null,
        stateProvince: null,
        country: null,
        emergencyContact: null,
        allowDeferredDuesPayment: false,
        allowEarlyRegistration: false,
        allowNoJob: false,
        allowRegistration: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockSafeUser);

      // Act
      const result = await strategy.validate(payload);

      // Assert
      expect(result).toEqual(mockSafeUser);
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('verificationToken');
      expect(result).not.toHaveProperty('resetToken');
      expect(result).not.toHaveProperty('resetTokenExpiry');
      expect(result).not.toHaveProperty('loginCode');
      expect(result).not.toHaveProperty('loginCodeExpiry');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: SAFE_USER_SELECT,
      });
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      // Arrange
      const payload = { sub: 'non-existent-id', email: 'test@example.com' };
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
        select: SAFE_USER_SELECT,
      });
    });
  });
}); 