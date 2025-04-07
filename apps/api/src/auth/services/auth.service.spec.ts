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
    role: UserRole.PARTICIPANT,
    isEmailVerified: false,
    verificationToken: 'verification-token',
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profilePicture: null,
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
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateCredentials('nonexistent@example.com', 'password');
      
      expect(result).toBeNull();
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
    });

    it('should return null for invalid password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateCredentials('test@example.com', 'wrongpassword');
      
      expect(result).toBeNull();
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword123');
    });

    it('should return user without password for valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateCredentials('test@example.com', 'correctpassword');
      
      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('correctpassword', 'hashedPassword123');
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
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow('User with this email already exists');
      
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      });
    });

    it('should create a new user and send verification email', async () => {
      // Setup mocks
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
      
      // Call method
      const result = await service.register(registerDto);
      
      // Assertions
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
  });

  describe('login', () => {
    // Create a type-safe user without password property
    const userWithoutPassword: Omit<User, 'password'> = {
      id: mockUser.id,
      email: mockUser.email,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      playaName: mockUser.playaName,
      role: mockUser.role,
      isEmailVerified: mockUser.isEmailVerified,
      verificationToken: mockUser.verificationToken,
      resetToken: mockUser.resetToken,
      resetTokenExpiry: mockUser.resetTokenExpiry,
      createdAt: mockUser.createdAt,
      updatedAt: mockUser.updatedAt,
      profilePicture: mockUser.profilePicture,
    };

    it('should return user data with JWT token', async () => {
      const result = await service.login(userWithoutPassword);
      
      expect(result).toHaveProperty('accessToken', 'mocked-jwt-token');
      expect(result).toHaveProperty('userId', 'user-id-1');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: 'test@example.com',
        sub: 'user-id-1',
        role: UserRole.PARTICIPANT,
      });
    });
  });

  describe('verifyEmail', () => {
    it('should return false if no user found with token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      
      const result = await service.verifyEmail('invalid-token');
      
      expect(result).toBe(false);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { verificationToken: 'invalid-token' },
      });
    });
    
    it('should verify email and clear verification token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      
      const result = await service.verifyEmail('verification-token');
      
      expect(result).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          isEmailVerified: true,
          verificationToken: null,
        },
      });
    });
  });

  describe('initiatePasswordReset', () => {
    it('should return true even if user not found (for security)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      
      const result = await service.initiatePasswordReset('nonexistent@example.com');
      
      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(notificationsService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
    
    it('should generate reset token and send password reset email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      
      const result = await service.initiatePasswordReset('test@example.com');
      
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
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      
      const result = await service.resetPassword('invalid-token', 'newPassword123');
      
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
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('mockedsalt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewPassword');
      
      const result = await service.resetPassword('valid-reset-token', 'newPassword123');
      
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
  });
});