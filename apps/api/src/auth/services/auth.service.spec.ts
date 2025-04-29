import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import { User, UserRole } from '@prisma/client';
import { NotificationsService } from '../../notifications/services/notifications.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { ConflictException, BadRequestException } from '@nestjs/common';

// Mock external dependencies
jest.mock('bcrypt');
jest.mock('uuid');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let notificationsService: NotificationsService;

  // Mock user data
  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
    password: 'hashedPassword123',
    firstName: 'Test',
    lastName: 'User',
    playaName: 'TestUser',
    profilePicture: null,
    phone: null,
    city: null,
    stateProvince: null,
    country: null,
    emergencyContact: null,
    role: UserRole.PARTICIPANT,
    isEmailVerified: false,
    allowRegistration: true,
    allowEarlyRegistration: false,
    allowDeferredDuesPayment: false,
    allowNoJob: false,
    internalNotes: null,
    verificationToken: 'verification-token',
    resetToken: null,
    resetTokenExpiry: null,
    loginCode: null,
    loginCodeExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  // Mock prisma service
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  // Mock JWT service
  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mocked-jwt-token'),
  };

  // Mock config service
  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      switch (key) {
        case 'jwt.secret':
          return 'test-secret';
        case 'jwt.expirationTime':
          return '1h';
        default:
          return undefined;
      }
    }),
  };

  // Mock notifications service
  const mockNotificationsService = {
    sendEmailVerificationEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    sendLoginCodeEmail: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    
    // Setup uuid mock to return predictable values
    (uuidv4 as jest.Mock).mockReturnValue('mocked-uuid-token');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateCredentials', () => {
    it('should return null for non-existent user', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.validateCredentials('nonexistent@example.com', 'password');
      
      // Assert
      expect(result).toBeNull();
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
    });

    it('should return null for invalid password', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await service.validateCredentials('test@example.com', 'wrongpassword');
      
      // Assert
      expect(result).toBeNull();
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword123');
    });

    it('should return user without password for valid credentials', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.validateCredentials('test@example.com', 'correctpassword');
      
      // Assert
      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('correctpassword', 'hashedPassword123');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.validateCredentials('test@example.com', 'password');
      
      // Assert
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
      playaName: 'NewUser',
    };

    it('should throw ConflictException if user already exists', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('User with this email already exists');
      
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      });
    });

    it('should create a new user and send verification email', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('mockedsalt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewPassword');
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        id: 'new-user-id',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        playaName: 'NewUser',
        password: 'hashedNewPassword',
        verificationToken: 'mocked-uuid-token',
      });
      
      // Act
      const result = await service.register(registerDto);
      
      // Assert
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('email', 'new@example.com');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'new@example.com',
          password: 'hashedNewPassword',
          verificationToken: 'mocked-uuid-token',
        }),
      });
      expect(notificationsService.sendEmailVerificationEmail).toHaveBeenCalledWith(
        'new@example.com',
        'mocked-uuid-token'
      );
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 'mockedsalt');
    });

    it('should throw BadRequestException if registration fails', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
      await expect(service.register(registerDto)).rejects.toThrow('User registration failed');
    });
  });

  describe('login', () => {
    it('should return user data with JWT token', async () => {
      // Arrange
      const userForLogin = {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
      };
      
      // Act
      const result = await service.login(userForLogin as any);
      
      // Assert
      expect(result).toHaveProperty('accessToken', 'mocked-jwt-token');
      expect(result).toHaveProperty('userId', 'user-id-1');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('firstName', 'Test');
      expect(result).toHaveProperty('lastName', 'User');
      expect(result).toHaveProperty('role', 'PARTICIPANT');
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: 'test@example.com',
        sub: 'user-id-1',
        role: UserRole.PARTICIPANT,
      });
    });
  });

  describe('verifyEmail', () => {
    it('should return false if no user found with token', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      
      // Act
      const result = await service.verifyEmail('invalid-token');
      
      // Assert
      expect(result).toBe(false);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { verificationToken: 'invalid-token' },
      });
    });
    
    it('should verify email and clear verification token', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      
      // Act
      const result = await service.verifyEmail('verification-token');
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          isEmailVerified: true,
          verificationToken: null,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockRejectedValue(new Error('Database error'));
      
      // Act
      const result = await service.verifyEmail('verification-token');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('initiatePasswordReset', () => {
    it('should return true even if user not found (for security)', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      
      // Act
      const result = await service.initiatePasswordReset('nonexistent@example.com');
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(notificationsService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
    
    it('should generate reset token and send password reset email', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      
      // Act
      const result = await service.initiatePasswordReset('test@example.com');
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          resetToken: 'mocked-uuid-token',
          resetTokenExpiry: expect.any(Date),
        }),
      });
      expect(notificationsService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        'mocked-uuid-token'
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockRejectedValue(new Error('Database error'));
      
      // Act
      const result = await service.initiatePasswordReset('test@example.com');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('resetPassword', () => {
    beforeEach(() => {
      // Create a valid token expiry date (future)
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      
      mockUser.resetToken = 'valid-reset-token';
      mockUser.resetTokenExpiry = futureDate;
    });
    
    it('should return false if no user found with valid token', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      
      // Act
      const result = await service.resetPassword('invalid-token', 'newPassword123');
      
      // Assert
      expect(result).toBe(false);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          resetToken: 'invalid-token',
          resetTokenExpiry: {
            gt: expect.any(Date),
          },
        },
      });
    });
    
    it('should reset password and clear reset token', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('mockedsalt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewPassword');
      
      // Act
      const result = await service.resetPassword('valid-reset-token', 'newPassword123');
      
      // Assert
      expect(result).toBe(true);
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 'mockedsalt');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          password: 'hashedNewPassword',
          resetToken: null,
          resetTokenExpiry: null,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockRejectedValue(new Error('Database error'));
      
      // Act
      const result = await service.resetPassword('valid-reset-token', 'newPassword123');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('generateLoginCode', () => {
    it('should generate a login code for a valid user', async () => {
      // Arrange
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      };

      // Mock successful notification
      const mockSendLoginCodeEmail = jest.fn().mockResolvedValue(true);
      notificationsService.sendLoginCodeEmail = mockSendLoginCodeEmail;

      // Mock user retrieval
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      
      // Mock user update
      prismaService.user.update = jest.fn().mockImplementation((args) => {
        expect(args.where.id).toBe(mockUser.id);
        expect(args.data.loginCode).toBeDefined();
        expect(args.data.loginCodeExpiry).toBeDefined();
        return Promise.resolve({ ...mockUser, ...args.data });
      });

      // Act
      const result = await service.generateLoginCode(mockUser.email);
      
      // Assert
      expect(result).toBe(true);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockUser.email },
      });
      expect(prismaService.user.update).toHaveBeenCalled();
      expect(mockSendLoginCodeEmail).toHaveBeenCalled();
    });

    it('should return true even if the user does not exist (prevent user enumeration)', async () => {
      // Arrange
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act
      const result = await service.generateLoginCode('nonexistent@example.com');
      
      // Assert
      expect(result).toBe(true);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      prismaService.user.findUnique = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.generateLoginCode('test@example.com');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('validateLoginCode', () => {
    it('should validate a valid login code', async () => {
      // Arrange
      // Mock valid code expiry time (future)
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 10);
      
      // Mock user with valid code
      const mockUserWithCode = {
        id: 'test-user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        loginCode: '123456',
        loginCodeExpiry: futureDate,
      };

      // Mock user retrieval
      prismaService.user.findFirst = jest.fn().mockResolvedValue(mockUserWithCode);
      
      // Mock user update to clear the code
      prismaService.user.update = jest.fn().mockResolvedValue({ 
        ...mockUserWithCode, 
        loginCode: null, 
        loginCodeExpiry: null 
      });

      // Act
      const result = await service.validateLoginCode(mockUserWithCode.email, mockUserWithCode.loginCode);
      
      // Assert
      // Use non-null assertion since we've verified result is not null in the test
      expect(result).toBeDefined();
      if (result) {
        expect(result.id).toBe(mockUserWithCode.id);
        expect(result.email).toBe(mockUserWithCode.email);
        // password should be omitted
        expect('password' in result).toBe(false);
      }
      
      // Verify that code was cleared
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserWithCode.id },
        data: {
          loginCode: null,
          loginCodeExpiry: null,
        },
      });
    });

    it('should return null for invalid code', async () => {
      // Arrange
      // Mock that no user was found with the provided code
      prismaService.user.findFirst = jest.fn().mockResolvedValue(null);

      // Act
      const result = await service.validateLoginCode('test@example.com', 'invalid-code');
      
      // Assert
      expect(result).toBeNull();
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should return null for expired code', async () => {
      // Arrange
      // Mock expired code (past date)
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 30);
      
      // Mock user with expired code
      const mockUserWithExpiredCode = {
        id: 'test-user-id',
        email: 'test@example.com',
        loginCode: '123456',
        loginCodeExpiry: pastDate,
      };

      // Mock no user found (due to expiry check in query)
      prismaService.user.findFirst = jest.fn().mockResolvedValue(null);

      // Act
      const result = await service.validateLoginCode(mockUserWithExpiredCode.email, mockUserWithExpiredCode.loginCode);
      
      // Assert
      expect(result).toBeNull();
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      prismaService.user.findFirst = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.validateLoginCode('test@example.com', '123456');
      
      // Assert
      expect(result).toBeNull();
    });
  });

  describe('hashPassword', () => {
    it('should hash passwords correctly', async () => {
      // Arrange
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('test-salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password-result');
      
      // Expose the private method for testing
      const hashPassword = (service as any).hashPassword.bind(service);
      
      // Act
      const result = await hashPassword('plain-password');
      
      // Assert
      expect(result).toBe('hashed-password-result');
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('plain-password', 'test-salt');
    });
  });
});