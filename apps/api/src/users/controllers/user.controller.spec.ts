import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from '../services/user.service';
import { UserRole } from '@prisma/client';
import { CreateUserDto } from '../dto/create-user.dto';

describe('UserController', () => {
  let controller: UserController;
  let userServiceMock: any;

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
    // Create a mock of the user service
    userServiceMock = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: userServiceMock,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      // Arrange
      const expectedUsers = [mockUser];
      userServiceMock.findAll.mockResolvedValue(expectedUsers);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(expectedUsers);
      expect(userServiceMock.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return a user when user exists', async () => {
      // Arrange
      userServiceMock.findById.mockResolvedValue(mockUser);

      // Act
      const result = await controller.findById('test-uuid');

      // Assert
      expect(result).toEqual(mockUser);
      expect(userServiceMock.findById).toHaveBeenCalledWith('test-uuid');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userServiceMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.findById('non-existent-uuid')).rejects.toThrow(NotFoundException);
      expect(userServiceMock.findById).toHaveBeenCalledWith('non-existent-uuid');
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

      const createdUser = {
        ...mockUser,
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      };

      userServiceMock.create.mockResolvedValue(createdUser);

      // Act
      const result = await controller.create(createUserDto);

      // Assert
      expect(result).toEqual(createdUser);
      expect(userServiceMock.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe('update', () => {
    it('should update and return the user', async () => {
      // Arrange
      const updateData = { firstName: 'Updated', lastName: 'Name' };
      const updatedUser = { ...mockUser, ...updateData };
      
      userServiceMock.update.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.update('test-uuid', updateData);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(userServiceMock.update).toHaveBeenCalledWith('test-uuid', updateData);
    });

    it('should pass through NotFoundException from service', async () => {
      // Arrange
      const updateData = { firstName: 'Updated' };
      userServiceMock.update.mockRejectedValue(new NotFoundException('User not found'));

      // Act & Assert
      await expect(controller.update('non-existent-id', updateData)).rejects.toThrow(NotFoundException);
      expect(userServiceMock.update).toHaveBeenCalledWith('non-existent-id', updateData);
    });
  });

  describe('delete', () => {
    it('should call service delete method', async () => {
      // Arrange
      userServiceMock.delete.mockResolvedValue(mockUser);

      // Act
      await controller.delete('test-uuid');

      // Assert
      expect(userServiceMock.delete).toHaveBeenCalledWith('test-uuid');
    });

    it('should pass through NotFoundException from service', async () => {
      // Arrange
      userServiceMock.delete.mockRejectedValue(new NotFoundException('User not found'));

      // Act & Assert
      await expect(controller.delete('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(userServiceMock.delete).toHaveBeenCalledWith('non-existent-id');
    });
  });
});