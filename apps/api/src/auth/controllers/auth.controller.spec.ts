import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { User, UserRole } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

// Define the request with user interface to match controller type
interface RequestWithUser extends Request {
  user: Omit<User, 'password'>;
}

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  // Mock user without password
  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
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
  } as Omit<User, 'password'>;

  // Mock auth response
  const mockAuthResponse = {
    accessToken: 'mock-jwt-token',
    userId: 'user-id-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'PARTICIPANT',
  };

  // Mock auth service
  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    verifyEmail: jest.fn(),
    initiatePasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return auth response', async () => {
      const registerDto: RegisterDto = {
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
        playaName: 'NewUser',
      };

      mockAuthService.register.mockResolvedValue(mockUser);
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);
      
      expect(result).toEqual(mockAuthResponse);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(authService.login).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('login', () => {
    it('should return auth response for authenticated user', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const req = { user: mockUser } as RequestWithUser;
      const result = await controller.login(req);
      
      expect(result).toEqual(mockAuthResponse);
      expect(authService.login).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully with valid token', async () => {
      mockAuthService.verifyEmail.mockResolvedValue(true);

      const result = await controller.verifyEmail('valid-token');
      
      expect(result).toEqual({ message: 'Email verified successfully' });
      expect(authService.verifyEmail).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException with invalid token', async () => {
      mockAuthService.verifyEmail.mockResolvedValue(false);

      await expect(controller.verifyEmail('invalid-token')).rejects.toThrow(UnauthorizedException);
      expect(authService.verifyEmail).toHaveBeenCalledWith('invalid-token');
    });
  });

  describe('forgotPassword', () => {
    it('should initiate password reset', async () => {
      mockAuthService.initiatePasswordReset.mockResolvedValue(true);

      const result = await controller.forgotPassword('test@example.com');
      
      expect(result).toEqual({ 
        message: 'If your email exists in our system, you will receive a password reset link' 
      });
      expect(authService.initiatePasswordReset).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      mockAuthService.resetPassword.mockResolvedValue(true);

      const result = await controller.resetPassword('valid-token', 'NewPassword123!');
      
      expect(result).toEqual({ message: 'Password reset successfully' });
      expect(authService.resetPassword).toHaveBeenCalledWith('valid-token', 'NewPassword123!');
    });

    it('should throw UnauthorizedException with invalid token', async () => {
      mockAuthService.resetPassword.mockResolvedValue(false);

      await expect(controller.resetPassword('invalid-token', 'NewPassword123!')).rejects.toThrow(UnauthorizedException);
      expect(authService.resetPassword).toHaveBeenCalledWith('invalid-token', 'NewPassword123!');
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const req = { user: mockUser } as RequestWithUser;
      
      const result = await controller.getProfile(req);
      
      expect(result).toEqual(mockUser);
    });
  });

  describe('testAuth', () => {
    it('should return success message', () => {
      const result = controller.testAuth();
      
      expect(result).toEqual({ message: 'Authentication is working' });
    });
  });
});