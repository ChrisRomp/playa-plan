import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { User, UserRole } from '@prisma/client';
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestLoginCodeDto } from '../dto/request-login-code.dto';
import { EmailCodeLoginDto } from '../dto/email-code-login.dto';

// Setup mock functions for testing
const setupMockUser = (): User => ({
  id: 'user-id-1',
  email: 'test@example.playaplan.app',
  password: null, // null for password since we don't want to expose it in tests
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
  updatedAt: new Date()
});

// Define an interface for the mock request with user data
interface MockRequest {
  user: User;
}

// Simple mock request builder that Jest can handle
function createMockRequest(userData: User): MockRequest {
  return {
    user: userData,
  };
}

describe('AuthController', () => {
  let controller: AuthController;

  // Mock user without password
  const mockUser = setupMockUser();

  // Mock auth response
  const mockAuthResponse = {
    accessToken: 'mock-jwt-token',
    userId: 'user-id-1',
    email: 'test@example.playaplan.app',
    firstName: 'Test',
    lastName: 'User',
    role: 'PARTICIPANT',
  };

  // Mock auth service
  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    validateCredentials: jest.fn(),
    verifyEmail: jest.fn(),
    generateLoginCode: jest.fn(),
    validateLoginCode: jest.fn(),
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
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should create a new user', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        email: 'new@example.playaplan.app',
        firstName: 'New',
        lastName: 'User',
        playaName: 'NewUser',
      };
      
      mockAuthService.register.mockResolvedValue(mockUser);
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      // Act
      const result = await controller.register(registerDto);

      // Assert
      expect(result).toEqual(mockAuthResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(mockAuthService.login).toHaveBeenCalledWith(mockUser);
    });

    it('should throw if user registration fails', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        email: 'new@example.playaplan.app',
        firstName: 'New',
        lastName: 'User',
        playaName: 'NewUser',
      };
      
      mockAuthService.register.mockRejectedValue(
        new ConflictException('User with this email already exists')
      );

      // Act & Assert
      await expect(controller.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate and return a JWT token with user info', async () => {
      // Arrange
      const req = createMockRequest(mockUser);
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      // Handle TypeScript build errors with a type assertion
      // Act
      // @ts-expect-error - For build process only, tests will work correctly
      const result = await controller.login(req);

      // Assert
      expect(result).toEqual(mockAuthResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      // Arrange
      mockAuthService.verifyEmail.mockResolvedValue(true);

      // Act
      const result = await controller.verifyEmail('valid-token');

      // Assert
      expect(result).toEqual({ message: 'Email verified successfully' });
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      // Arrange
      mockAuthService.verifyEmail.mockResolvedValue(false);

      // Act & Assert
      await expect(controller.verifyEmail('invalid-token')).rejects.toThrow(UnauthorizedException);
      await expect(controller.verifyEmail('invalid-token')).rejects.toThrow('Invalid or expired verification token');
    });
  });

  // Password reset functionality removed in favor of email verification

  // Password reset functionality removed in favor of email verification

  describe('requestLoginCode', () => {
    it('should request a login code successfully', async () => {
      // Arrange
      const loginEmailDto: RequestLoginCodeDto = { email: 'test@example.playaplan.app' };
      mockAuthService.generateLoginCode.mockResolvedValue(true);

      // Act
      const result = await controller.requestLoginCode(loginEmailDto);

      // Assert
      expect(result).toEqual({ 
        message: 'If your email exists in our system, you will receive a login code' 
      });
      expect(mockAuthService.generateLoginCode).toHaveBeenCalledWith('test@example.playaplan.app');
    });

    it('should throw BadRequestException if login code generation fails', async () => {
      // Arrange
      const loginEmailDto: RequestLoginCodeDto = { email: 'test@example.playaplan.app' };
      mockAuthService.generateLoginCode.mockResolvedValue(false);

      // Act & Assert
      await expect(controller.requestLoginCode(loginEmailDto)).rejects.toThrow(BadRequestException);
      await expect(controller.requestLoginCode(loginEmailDto)).rejects.toThrow('Failed to send login code');
    });
  });

  describe('loginWithCode', () => {
    it('should verify login code and return JWT token with user info', async () => {
      // Arrange
      const emailCodeLoginDto: EmailCodeLoginDto = {
        email: 'test@example.playaplan.app',
        code: '123456',
      };
      mockAuthService.validateLoginCode.mockResolvedValue(mockUser);
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      // Act
      const result = await controller.loginWithCode(emailCodeLoginDto);

      // Assert
      expect(result).toEqual(mockAuthResponse);
      expect(mockAuthService.validateLoginCode).toHaveBeenCalledWith('test@example.playaplan.app', '123456');
      expect(mockAuthService.login).toHaveBeenCalledWith(mockUser);
    });

    it('should throw UnauthorizedException for invalid login code', async () => {
      // Arrange
      const emailCodeLoginDto: EmailCodeLoginDto = {
        email: 'test@example.playaplan.app',
        code: 'invalid',
      };
      mockAuthService.validateLoginCode.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.loginWithCode(emailCodeLoginDto)).rejects.toThrow(UnauthorizedException);
      await expect(controller.loginWithCode(emailCodeLoginDto)).rejects.toThrow('Invalid or expired verification code');
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      // Arrange
      const req = createMockRequest(mockUser);
      
      // Act
      // @ts-expect-error - For build process only, tests will work correctly
      const result = await controller.getProfile(req);

      // Assert
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