import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Mock bcrypt for password hashing
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

describe('UserService', () => {
  let service: UserService;
  let prismaServiceMock: any;

  const mockUser = {
    id: 'test-uuid',
    email: 'test@example.com',
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
      ],
    }).compile();

    service = module.get<UserService>(UserService);
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
      const result = await service.findByEmail('test@example.com');

      // Assert
      expect(result).toEqual(mockUser);
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when email does not exist', async () => {
      // Arrange
      prismaServiceMock.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
      expect(prismaServiceMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
    });
  });

  describe('create', () => {
    it('should create and return a new user', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'new@example.com',
        password: 'password123',
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
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'salt');
      expect(prismaServiceMock.user.create).toHaveBeenCalledWith({
        data: {
          email: createUserDto.email,
          password: 'hashed_password',
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          role: createUserDto.role,
        },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'existing@example.com',
        password: 'password123',
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
});