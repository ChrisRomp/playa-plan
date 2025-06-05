import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/services/auth.service';
import { UserService } from '../users/services/user.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/services/notifications.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { normalizeEmail } from '../common/utils/email.utils';

describe('Email Case Insensitivity Integration', () => {
  let authService: AuthService;
  let userService: UserService;

  // Mock Prisma Service
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  // Mock other services
  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      switch (key) {
        case 'nodeEnv':
          return 'test';
        default:
          return undefined;
      }
    }),
  };

  const mockNotificationsService = {
    sendEmailVerificationEmail: jest.fn().mockResolvedValue(true),
    sendLoginCodeEmail: jest.fn().mockResolvedValue(true),
    sendEmailChangeNotificationToOldEmail: jest.fn().mockResolvedValue(true),
    sendEmailChangeNotificationToNewEmail: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Email Normalization Integration', () => {
    it('should prevent duplicate registrations with different email cases', async () => {
      // Scenario: User tries to register with 'TEST@EXAMPLE.COM' 
      // but 'test@example.com' already exists in database

      const existingUser = {
        id: 'existing-user-id',
        email: 'test@example.com', // lowercase in database
        firstName: 'Existing',
        lastName: 'User',
        password: null,
      };

      const registerDto = {
        email: 'TEST@EXAMPLE.COM', // uppercase attempt
        firstName: 'Test',
        lastName: 'User',
      };

      // Mock: database lookup will find existing user because email is normalized
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toThrow(BadRequestException);

      // Verify that the database was queried with normalized email
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: normalizeEmail(registerDto.email) },
      });
    });

    it('should normalize emails in login code generation', async () => {
      // Scenario: User requests login code with mixed case email
      const mixedCaseEmail = 'User.Name+Test@Example.COM';
      const normalizedEmail = normalizeEmail(mixedCaseEmail);

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: normalizedEmail,
        loginCode: '123456',
        firstName: '',
        lastName: '',
      });

      // Act
      const result = await authService.generateLoginCode(mixedCaseEmail);

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: normalizedEmail },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: normalizedEmail,
        }),
      });
    });

    it('should validate login codes with case-insensitive email lookup', async () => {
      // Scenario: User generated code with one case, validates with different case
      const originalEmail = 'test@example.com';
      const validationEmail = 'TEST@Example.Com';
      const loginCode = '123456';

      const userWithCode = {
        id: 'user-id',
        email: originalEmail,
        loginCode,
        loginCodeExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      };

      mockPrismaService.user.findFirst.mockResolvedValue(userWithCode);
      mockPrismaService.user.count.mockResolvedValue(1); // Not first user
      mockPrismaService.user.update.mockResolvedValue({
        ...userWithCode,
        loginCode: null,
        loginCodeExpiry: null,
        isEmailVerified: true,
      });

      // Act
      const result = await authService.validateLoginCode(validationEmail, loginCode);

      // Assert
      expect(result).toBeDefined();
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: normalizeEmail(validationEmail),
          loginCode,
          loginCodeExpiry: {
            gt: expect.any(Date),
          },
        },
      });
    });

    it('should prevent email updates that would create case-sensitivity conflicts', async () => {
      // Scenario: User A tries to change email to variation of User B's email
      const userA = {
        id: 'user-a-id',
        email: 'usera@example.com',
        firstName: 'User',
        lastName: 'A',
      };

      const userB = {
        id: 'user-b-id',
        email: 'userb@example.com', // Note: different user
        firstName: 'User',
        lastName: 'B',
      };

      const updateDto = {
        email: 'USERB@EXAMPLE.COM', // Trying to change to User B's email with different case
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(userA) // findById call
        .mockResolvedValueOnce(userB); // findByEmail call - finds conflict

      // Act & Assert
      await expect(userService.update(userA.id, updateDto)).rejects.toThrow(ConflictException);

      // Verify normalized email was used for conflict check
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: normalizeEmail(updateDto.email) },
      });
    });

    it('should handle email lookup with case insensitivity', async () => {
      const storedEmail = 'user@example.com';
      const lookupEmail = 'USER@EXAMPLE.COM';

      const user = {
        id: 'user-id',
        email: storedEmail,
        firstName: 'Test',
        lastName: 'User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await userService.findByEmail(lookupEmail);

      // Assert
      expect(result).toEqual(user);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: normalizeEmail(lookupEmail) },
      });
    });
  });

  describe('Email normalization utility', () => {
    it('should handle various email case scenarios', () => {
      const testCases = [
        { input: 'user@example.com', expected: 'user@example.com' },
        { input: 'USER@EXAMPLE.COM', expected: 'user@example.com' },
        { input: 'User@Example.Com', expected: 'user@example.com' },
        { input: '  User@Example.Com  ', expected: 'user@example.com' },
        { input: 'Test.User+Tag@Sub.Domain.COM', expected: 'test.user+tag@sub.domain.com' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(normalizeEmail(input)).toBe(expected);
      });
    });
  });
});