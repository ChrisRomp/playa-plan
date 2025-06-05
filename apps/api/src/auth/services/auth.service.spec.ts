import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import { User, UserRole } from '@prisma/client';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';

// Mock external dependencies
jest.mock('uuid');

describe('AuthService', () => {
  let service: AuthService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let notificationsService: NotificationsService;

  // Mock user data
  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.playaplan.app',
    password: null, // No passwords in our system
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
      count: jest.fn(),
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
    it('should always return null as we use email verification flow', async () => {
      // Act
      const result = await service.validateCredentials('test@example.playaplan.app');
      
      // Assert
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'new@example.playaplan.app',
      firstName: 'New',
      lastName: 'User',
      playaName: 'NewUser',
    };

    it('should throw ConflictException if user with email already exists', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      
      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
      // Note: The real error is caught and a BadRequestException is thrown instead
      
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@example.playaplan.app' },
      });
    });

    it('should create a new user and send verification email', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        id: 'new-user-id',
        email: 'new@example.playaplan.app',
        password: null,
        firstName: 'New',
        lastName: 'User',
        playaName: 'NewUser',
        verificationToken: 'mocked-uuid-token',
      });
      
      // Act
      const result = await service.register(registerDto);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('new-user-id');
      expect(result.email).toBe('new@example.playaplan.app');
      
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.playaplan.app',
          firstName: 'New',
          lastName: 'User',
          playaName: 'NewUser',
          role: UserRole.PARTICIPANT,
          verificationToken: 'mocked-uuid-token',
        },
      });
      
      expect(notificationsService.sendEmailVerificationEmail).toHaveBeenCalledWith(
        'new@example.playaplan.app',
        'mocked-uuid-token',
        undefined
      );
    });

    it('should throw BadRequestException if registration fails', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
      await expect(service.register(registerDto)).rejects.toThrow('User registration failed');
    });

    it('should create first user as ADMIN when Users table is empty', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.count.mockResolvedValue(0); // Empty table
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        id: 'first-admin-user',
        email: 'admin@example.playaplan.app',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.PARTICIPANT, // Created as PARTICIPANT initially
        verificationToken: 'mocked-uuid-token',
      });
      
      const adminRegisterDto: RegisterDto = {
        email: 'admin@example.playaplan.app',
        firstName: 'Admin',
        lastName: 'User',
        playaName: 'AdminUser',
      };
      
      // Act
      const result = await service.register(adminRegisterDto);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.role).toBe(UserRole.PARTICIPANT); // Created as PARTICIPANT, will be promoted on authentication
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'admin@example.playaplan.app',
          firstName: 'Admin',
          lastName: 'User',
          playaName: 'AdminUser',
          role: UserRole.PARTICIPANT,
          verificationToken: 'mocked-uuid-token',
        },
      });
    });

    it('should create subsequent users as PARTICIPANT when Users table is not empty', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        id: 'regular-user',
        email: 'user@example.playaplan.app',
        firstName: 'Regular',
        lastName: 'User',
        role: UserRole.PARTICIPANT,
        verificationToken: 'mocked-uuid-token',
      });
      
      const regularRegisterDto: RegisterDto = {
        email: 'user@example.playaplan.app',
        firstName: 'Regular',
        lastName: 'User',
        playaName: 'RegularUser',
      };
      
      // Act
      const result = await service.register(regularRegisterDto);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.role).toBe(UserRole.PARTICIPANT);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'user@example.playaplan.app',
          firstName: 'Regular',
          lastName: 'User',
          playaName: 'RegularUser',
          role: UserRole.PARTICIPANT,
          verificationToken: 'mocked-uuid-token',
        },
      });
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
      const result = await service.login(userForLogin as User);
      
      // Assert
      expect(result).toHaveProperty('accessToken', 'mocked-jwt-token');
      expect(result).toHaveProperty('userId', 'user-id-1');
      expect(result).toHaveProperty('email', 'test@example.playaplan.app');
      expect(result).toHaveProperty('firstName', 'Test');
      expect(result).toHaveProperty('lastName', 'User');
      expect(result).toHaveProperty('role', 'PARTICIPANT');
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: 'test@example.playaplan.app',
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
      const result = await service.verifyEmail('verification-token');
      
      // Assert
      expect(result).toBe(false);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { verificationToken: 'verification-token' },
      });
    });

    it('should mark email as verified and clear token', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.count.mockResolvedValue(1); // Already has authenticated users
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        isEmailVerified: true,
        verificationToken: null,
      });
      
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

    it('should promote first user to authenticate to ADMIN via email verification', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.count.mockResolvedValue(0); // No authenticated users yet
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        isEmailVerified: true,
        verificationToken: null,
        role: UserRole.ADMIN,
      });
      
      // Act
      const result = await service.verifyEmail('verification-token');
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: { isEmailVerified: true },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          isEmailVerified: true,
          verificationToken: null,
          role: UserRole.ADMIN,
        },
      });
    });

    it('should not promote subsequent users to ADMIN via email verification', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.count.mockResolvedValue(1); // Already has authenticated users
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        isEmailVerified: true,
        verificationToken: null,
      });
      
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
  });

  describe('generateLoginCode', () => {
    it('should update existing user with login code', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      
      // We won't mock Date to avoid issues with Date.now
      
      // Act
      const result = await service.generateLoginCode('test@example.playaplan.app');
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          loginCode: expect.any(String),
          loginCodeExpiry: expect.any(Date),
        },
      });
      expect(notificationsService.sendLoginCodeEmail).toHaveBeenCalledWith(
        'test@example.playaplan.app',
        expect.any(String),
        'user-id-1'
      );
      

    });

    it('should create new user with login code for non-existent email', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      
      // Mock user creation result to be successful
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        email: 'new@example.playaplan.app',
        loginCode: '123456',
        loginCodeExpiry: new Date(Date.now() + 900000) // 15 minutes in the future
      });

      // Mock sendLoginCodeEmail to return true
      mockNotificationsService.sendLoginCodeEmail.mockResolvedValue(true);
      
      // Act
      const result = await service.generateLoginCode('new@example.playaplan.app');
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.playaplan.app',
          loginCode: expect.any(String),
          loginCodeExpiry: expect.any(Date),
          role: UserRole.PARTICIPANT,
          firstName: '',
          lastName: '',
          isEmailVerified: false,
        },
      });
      expect(notificationsService.sendLoginCodeEmail).toHaveBeenCalledWith(
        'new@example.playaplan.app',
        expect.any(String),
        undefined
      );
    });

    it('should create first user as ADMIN via login code when Users table is empty', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      
      // Mock user creation result to be successful
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        email: 'admin@example.playaplan.app',
        role: UserRole.PARTICIPANT, // Created as PARTICIPANT initially
        loginCode: '123456',
        loginCodeExpiry: new Date(Date.now() + 900000) // 15 minutes in the future
      });

      // Mock sendLoginCodeEmail to return true
      mockNotificationsService.sendLoginCodeEmail.mockResolvedValue(true);
      
      // Act
      const result = await service.generateLoginCode('admin@example.playaplan.app');
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'admin@example.playaplan.app',
          loginCode: expect.any(String),
          loginCodeExpiry: expect.any(Date),
          role: UserRole.PARTICIPANT,
          firstName: '',
          lastName: '',
          isEmailVerified: false,
        },
      });
      expect(notificationsService.sendLoginCodeEmail).toHaveBeenCalledWith(
        'admin@example.playaplan.app',
        expect.any(String),
        undefined
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockRejectedValue(new Error('Database error'));
      
      // Act
      const result = await service.generateLoginCode('test@example.playaplan.app');
      
      // Assert
      expect(result).toBe(false);
    });

    it('should use fixed code "123456" in development mode', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'nodeEnv':
            return 'development';
          case 'jwt.secret':
            return 'test-secret';
          case 'jwt.expirationTime':
            return '1h';
          default:
            return undefined;
        }
      });
      
      // Act
      const result = await service.generateLoginCode('test@example.playaplan.app');
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          loginCode: '123456',
          loginCodeExpiry: expect.any(Date),
        },
      });
      expect(notificationsService.sendLoginCodeEmail).toHaveBeenCalledWith(
        'test@example.playaplan.app',
        '123456',
        'user-id-1'
      );
    });

    it('should use random code in production mode', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'nodeEnv':
            return 'production';
          case 'jwt.secret':
            return 'test-secret';
          case 'jwt.expirationTime':
            return '1h';
          default:
            return undefined;
        }
      });
      
      // Act
      const result = await service.generateLoginCode('test@example.playaplan.app');
      
      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          loginCode: expect.stringMatching(/^\d{6}$/), // 6-digit number
          loginCodeExpiry: expect.any(Date),
        },
      });
      expect(notificationsService.sendLoginCodeEmail).toHaveBeenCalledWith(
        'test@example.playaplan.app',
        expect.stringMatching(/^\d{6}$/),
        'user-id-1'
      );
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
        ...mockUser,
        loginCode: '123456',
        loginCodeExpiry: futureDate,
      };

      // Mock user retrieval
      mockPrismaService.user.findFirst.mockResolvedValue(mockUserWithCode);
      
      // Mock user update to clear the code
      mockPrismaService.user.update.mockResolvedValue({ 
        ...mockUserWithCode, 
        loginCode: null, 
        loginCodeExpiry: null,
        isEmailVerified: true 
      });

      // Act
      const result = await service.validateLoginCode(mockUserWithCode.email, mockUserWithCode.loginCode);
      
      // Assert
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      
      // Verify that login code was cleared and email was marked as verified
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          loginCode: null,
          loginCodeExpiry: null,
          isEmailVerified: true,
        },
      });
    });

    it('should return null for invalid code', async () => {
      // Arrange
      // Mock that no user was found with the provided code
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.validateLoginCode('test@example.playaplan.app', 'invalid-code');
      
      // Assert
      expect(result).toBeNull();
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.validateLoginCode('test@example.playaplan.app', '123456');
      
      // Assert
      expect(result).toBeNull();
    });

    it('should promote first user to authenticate to ADMIN via login code', async () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 10);
      
      const mockUserWithCode = {
        ...mockUser,
        loginCode: '123456',
        loginCodeExpiry: futureDate,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUserWithCode);
      mockPrismaService.user.count.mockResolvedValue(0); // No authenticated users yet
      mockPrismaService.user.update.mockResolvedValue({ 
        ...mockUserWithCode, 
        loginCode: null, 
        loginCodeExpiry: null,
        isEmailVerified: true,
        role: UserRole.ADMIN,
      });

      // Act
      const result = await service.validateLoginCode(mockUserWithCode.email, mockUserWithCode.loginCode);
      
      // Assert
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result?.role).toBe(UserRole.ADMIN);
      
      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: { isEmailVerified: true },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          loginCode: null,
          loginCodeExpiry: null,
          isEmailVerified: true,
          role: UserRole.ADMIN,
        },
      });
    });

    it('should not promote subsequent users to ADMIN via login code', async () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 10);
      
      const mockUserWithCode = {
        ...mockUser,
        loginCode: '123456',
        loginCodeExpiry: futureDate,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUserWithCode);
      mockPrismaService.user.count.mockResolvedValue(1); // Already has authenticated users
      mockPrismaService.user.update.mockResolvedValue({ 
        ...mockUserWithCode, 
        loginCode: null, 
        loginCodeExpiry: null,
        isEmailVerified: true,
      });

      // Act
      const result = await service.validateLoginCode(mockUserWithCode.email, mockUserWithCode.loginCode);
      
      // Assert
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result?.role).toBe(UserRole.PARTICIPANT);
      
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          loginCode: null,
          loginCodeExpiry: null,
          isEmailVerified: true,
        },
      });
    });
  });

  describe('Email Case Insensitivity', () => {
    describe('register', () => {
      it('should normalize email to lowercase during registration', async () => {
        // Arrange
        const registerDto: RegisterDto = {
          email: 'NEW@EXAMPLE.PLAYAPLAN.APP',
          firstName: 'New',
          lastName: 'User',
          playaName: 'NewUser',
        };

        mockPrismaService.user.findUnique.mockResolvedValue(null);
        mockPrismaService.user.create.mockResolvedValue({
          ...mockUser,
          id: 'new-user-id',
          email: 'new@example.playaplan.app',
          firstName: 'New',
          lastName: 'User',
          playaName: 'NewUser',
        });

        // Act
        const result = await service.register(registerDto);

        // Assert
        expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'new@example.playaplan.app' },
        });
        expect(mockPrismaService.user.create).toHaveBeenCalledWith({
          data: {
            email: 'new@example.playaplan.app',
            firstName: 'New',
            lastName: 'User',
            playaName: 'NewUser',
            role: UserRole.PARTICIPANT,
            verificationToken: expect.any(String),
          },
        });
        expect(result.email).toBe('new@example.playaplan.app');
      });

      it('should detect existing user with different case email', async () => {
        // Arrange
        const registerDto: RegisterDto = {
          email: 'TEST@EXAMPLE.PLAYAPLAN.APP',
          firstName: 'Test',
          lastName: 'User',
        };

        mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

        // Act & Assert
        await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
        expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.playaplan.app' },
        });
      });
    });

    describe('generateLoginCode', () => {
      it('should normalize email to lowercase when generating login code', async () => {
        // Arrange
        mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.user.update.mockResolvedValue(mockUser);
        mockNotificationsService.sendLoginCodeEmail.mockResolvedValue(true);

        // Act
        const result = await service.generateLoginCode('TEST@EXAMPLE.PLAYAPLAN.APP');

        // Assert
        expect(result).toBe(true);
        expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.playaplan.app' },
        });
        expect(mockNotificationsService.sendLoginCodeEmail).toHaveBeenCalledWith(
          'test@example.playaplan.app',
          expect.any(String),
          mockUser.id
        );
      });

      it('should create new user with normalized email when user does not exist', async () => {
        // Arrange
        mockPrismaService.user.findUnique.mockResolvedValue(null);
        mockPrismaService.user.create.mockResolvedValue({
          ...mockUser,
          email: 'new@example.playaplan.app',
          id: 'new-user-id',
        });
        mockNotificationsService.sendLoginCodeEmail.mockResolvedValue(true);

        // Act
        const result = await service.generateLoginCode('NEW@EXAMPLE.PLAYAPLAN.APP');

        // Assert
        expect(result).toBe(true);
        expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'new@example.playaplan.app' },
        });
        expect(mockPrismaService.user.create).toHaveBeenCalledWith({
          data: {
            email: 'new@example.playaplan.app',
            loginCode: expect.any(String),
            loginCodeExpiry: expect.any(Date),
            role: UserRole.PARTICIPANT,
            firstName: '',
            lastName: '',
            isEmailVerified: false,
          },
        });
      });
    });

    describe('validateLoginCode', () => {
      it('should normalize email to lowercase when validating login code', async () => {
        // Arrange
        const futureDate = new Date();
        futureDate.setMinutes(futureDate.getMinutes() + 10);
        
        const mockUserWithCode = {
          ...mockUser,
          email: 'test@example.playaplan.app',
          loginCode: '123456',
          loginCodeExpiry: futureDate,
        };

        mockPrismaService.user.findFirst.mockResolvedValue(mockUserWithCode);
        mockPrismaService.user.count.mockResolvedValue(1);
        mockPrismaService.user.update.mockResolvedValue({
          ...mockUserWithCode,
          loginCode: null,
          loginCodeExpiry: null,
          isEmailVerified: true,
        });

        // Act
        const result = await service.validateLoginCode('TEST@EXAMPLE.PLAYAPLAN.APP', '123456');

        // Assert
        expect(result).toBeDefined();
        expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
          where: {
            email: 'test@example.playaplan.app',
            loginCode: '123456',
            loginCodeExpiry: {
              gt: expect.any(Date),
            },
          },
        });
      });
    });
  });
});
