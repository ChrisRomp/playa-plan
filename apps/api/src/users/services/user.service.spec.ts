import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Mock bcrypt for password hashing
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

// Mock type for PrismaService with only the methods we need
type MockPrismaService = {
  user: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  $connect: jest.Mock;
  $disconnect: jest.Mock;
};

describe('UserService', () => {
  let service: UserService;
  let prismaServiceMock: MockPrismaService;
  let notificationsService: NotificationsService;

  const mockUser = {
    id: 'test-uuid',
    email: 'test@example.playaplan.app',
    password: 'hashed_password',
    firstName: 'Test',
    lastName: 'User',
    playaName: null,
    profilePicture: null,
    role: UserRole.PARTICIPANT,
    isEmailVerified: false,
    verificationToken: null,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Create a proper Prisma mock with all required methods
    prismaServiceMock = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: NotificationsService,
          useValue: {
            sendEmailChangeNotificationToOldEmail: jest.fn().mockResolvedValue(true),
            sendEmailChangeNotificationToNewEmail: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      // Arrange
      const expectedUsers = [mockUser];
      prismaServiceMock.user.findMany.mockResolvedValue(expectedUsers);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(expectedUsers);
      expect(prismaServiceMock.user.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return a user when user exists', async () => {
      // Arrange
      prismaServiceMock.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById('test-uuid');

      // Assert
      expect(result).toEqual(mockUser);
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
      });
    });

    it('should return null when user does not exist', async () => {
      // Arrange
      prismaServiceMock.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.findById('non-existent-uuid');

      // Assert
      expect(result).toBeNull();
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-uuid' },
      });
    });
  });

  describe('findByEmail', () => {
    it('should return a user when email exists', async () => {
      // Arrange
      prismaServiceMock.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByEmail('test@example.playaplan.app');

      // Assert
      expect(result).toEqual(mockUser);
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.playaplan.app' },
      });
    });

    it('should return null when email does not exist', async () => {
      // Arrange
      prismaServiceMock.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.findByEmail('nonexistent@example.playaplan.app');

      // Assert
      expect(result).toBeNull();
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.playaplan.app' },
      });
    });
  });

  describe('create', () => {
    it('should create and return a new user', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'new@example.playaplan.app',
        firstName: 'New',
        lastName: 'User',
        role: UserRole.PARTICIPANT,
      };

      prismaServiceMock.user.findUnique.mockResolvedValue(null);
      prismaServiceMock.user.create.mockResolvedValue({
        ...mockUser,
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      });

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(result.email).toBe(createUserDto.email);
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      expect(prismaServiceMock.user.create).toHaveBeenCalledWith({
        data: {
          email: createUserDto.email,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          role: createUserDto.role,
        },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'existing@example.playaplan.app',
        firstName: 'Existing',
        lastName: 'User',
        role: UserRole.PARTICIPANT,
      };

      prismaServiceMock.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      expect(prismaServiceMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return the user', async () => {
      // Arrange
      const updateData = { firstName: 'Updated', lastName: 'Name' };
      const updatedUser = { ...mockUser, ...updateData };
      
      prismaServiceMock.user.findUnique.mockResolvedValue(mockUser);
      prismaServiceMock.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await service.update('test-uuid', updateData);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
      });
      expect(prismaServiceMock.user.update).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
        data: updateData,
      });
    });

    it('should hash password when updating password', async () => {
      // Arrange
      const updateData = { password: 'newpassword123' };
      const updatedUser = { ...mockUser, password: 'hashed_password' };
      
      prismaServiceMock.user.findUnique.mockResolvedValue(mockUser);
      prismaServiceMock.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await service.update('test-uuid', updateData);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 'salt');
      expect(prismaServiceMock.user.update).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
        data: { password: 'hashed_password' },
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      prismaServiceMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent-id', { firstName: 'New' })).rejects.toThrow(
        NotFoundException
      );
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
      expect(prismaServiceMock.user.update).not.toHaveBeenCalled();
    });

    it('should not allow updating protected fields', async () => {
      // Arrange
      const updateData = { 
        id: 'new-id', 
        createdAt: new Date(), 
        updatedAt: new Date(),
        firstName: 'Protected' 
      };
      const expectedUpdateData = { firstName: 'Protected' };
      
      prismaServiceMock.user.findUnique.mockResolvedValue(mockUser);
      prismaServiceMock.user.update.mockResolvedValue({ ...mockUser, firstName: 'Protected' });

      // Act
      await service.update('test-uuid', updateData);

      // Assert
      expect(prismaServiceMock.user.update).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
        data: expectedUpdateData,
      });
    });
  });

  describe('delete', () => {
    it('should delete and return the user', async () => {
      // Arrange
      prismaServiceMock.user.findUnique.mockResolvedValue(mockUser);
      prismaServiceMock.user.delete.mockResolvedValue(mockUser);

      // Act
      const result = await service.delete('test-uuid');

      // Assert
      expect(result).toEqual(mockUser);
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
      });
      expect(prismaServiceMock.user.delete).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      prismaServiceMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
      expect(prismaServiceMock.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('Email Case Insensitivity', () => {
    describe('findByEmail', () => {
      it('should normalize email to lowercase when finding user', async () => {
        // Arrange
        prismaServiceMock.user.findUnique.mockResolvedValue(mockUser);

        // Act
        const result = await service.findByEmail('TEST@EXAMPLE.PLAYAPLAN.APP');

        // Assert
        expect(result).toEqual(mockUser);
        expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.playaplan.app' },
        });
      });
    });

    describe('create', () => {
      it('should normalize email to lowercase when creating user', async () => {
        // Arrange
        const createUserDto = {
          email: 'NEW@EXAMPLE.PLAYAPLAN.APP',
          firstName: 'New',
          lastName: 'User',
          role: UserRole.PARTICIPANT,
        };

        prismaServiceMock.user.findUnique.mockResolvedValue(null);
        prismaServiceMock.user.create.mockResolvedValue({
          ...mockUser,
          email: 'new@example.playaplan.app',
          firstName: 'New',
          lastName: 'User',
        });

        // Act
        const result = await service.create(createUserDto);

        // Assert
        expect(result.email).toBe('new@example.playaplan.app');
        expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'new@example.playaplan.app' },
        });
        expect(prismaServiceMock.user.create).toHaveBeenCalledWith({
          data: {
            email: 'new@example.playaplan.app',
            firstName: 'New',
            lastName: 'User',
            role: UserRole.PARTICIPANT,
          },
        });
      });

      it('should detect existing user with different case email', async () => {
        // Arrange
        const createUserDto = {
          email: 'TEST@EXAMPLE.PLAYAPLAN.APP',
          firstName: 'Test',
          lastName: 'User',
          role: UserRole.PARTICIPANT,
        };

        prismaServiceMock.user.findUnique.mockResolvedValue(mockUser);

        // Act & Assert
        await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
        expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.playaplan.app' },
        });
        expect(prismaServiceMock.user.create).not.toHaveBeenCalled();
      });
    });

    describe('update', () => {
      it('should normalize email to lowercase when updating user', async () => {
        // Arrange
        const updateUserDto = {
          email: 'UPDATED@EXAMPLE.PLAYAPLAN.APP',
          firstName: 'Updated',
        };

        prismaServiceMock.user.findUnique
          .mockResolvedValueOnce(mockUser) // findById call
          .mockResolvedValueOnce(null); // findByEmail call for conflict check

        prismaServiceMock.user.update.mockResolvedValue({
          ...mockUser,
          email: 'updated@example.playaplan.app',
          firstName: 'Updated',
        });

        (notificationsService.sendEmailChangeNotificationToOldEmail as jest.Mock).mockResolvedValue(true);
        (notificationsService.sendEmailChangeNotificationToNewEmail as jest.Mock).mockResolvedValue(true);

        // Act
        const result = await service.update('test-uuid', updateUserDto);

        // Assert
        expect(result.email).toBe('updated@example.playaplan.app');
        expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'updated@example.playaplan.app' },
        });
        expect(prismaServiceMock.user.update).toHaveBeenCalledWith({
          where: { id: 'test-uuid' },
          data: {
            email: 'updated@example.playaplan.app',
            firstName: 'Updated',
          },
        });
        expect(notificationsService.sendEmailChangeNotificationToOldEmail).toHaveBeenCalledWith(
          mockUser.email,
          'updated@example.playaplan.app',
          'test-uuid',
        );
        expect(notificationsService.sendEmailChangeNotificationToNewEmail).toHaveBeenCalledWith(
          'updated@example.playaplan.app',
          mockUser.email,
          'test-uuid',
        );
      });

      it('should detect email conflict with different case during update', async () => {
        // Arrange
        const updateUserDto = {
          email: 'EXISTING@EXAMPLE.PLAYAPLAN.APP',
        };

        const currentUser = {
          ...mockUser,
          id: 'test-uuid',
          email: 'test@example.playaplan.app', // different from the one being updated to
        };

        const existingUser = {
          ...mockUser,
          id: 'existing-user-id',
          email: 'existing@example.playaplan.app', // This conflicts with the update
        };

        prismaServiceMock.user.findUnique
          .mockResolvedValueOnce(currentUser) // findById call
          .mockResolvedValueOnce(existingUser); // findByEmail call for conflict check

        // Act & Assert
        await expect(service.update('test-uuid', updateUserDto)).rejects.toThrow(ConflictException);
        expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'existing@example.playaplan.app' },
        });
        expect(prismaServiceMock.user.update).not.toHaveBeenCalled();
      });
    });
  });
});