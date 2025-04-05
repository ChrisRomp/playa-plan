import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Mock external dependencies
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

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
  };

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

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
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

    it('should create a new user with hashed password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewPassword');
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        id: 'new-user-id',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        playaName: 'NewUser',
        password: 'hashedNewPassword',
      });

      const result = await service.register(registerDto);
      
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('email', 'new@example.com');
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
    });
  });

  describe('login', () => {
    const userWithoutPassword = { ...mockUser };
    delete userWithoutPassword.password;

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

  // Other tests for email verification and password reset would follow the same pattern
});