import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from '../services/user.service';
import { UserRole } from '@prisma/client';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';

// Mock the Request object
const mockRequest = () => {
  const req: any = {};
  req.user = {
    id: 'test-uuid',
    email: 'test@example.playaplan.app',
    role: UserRole.PARTICIPANT
  };
  return req;
};

const mockAdminRequest = () => {
  const req: any = {};
  req.user = {
    id: 'admin-uuid',
    email: 'admin@example.playaplan.app',
    role: UserRole.ADMIN
  };
  return req;
};

describe('UserController', () => {
  let controller: UserController;
  let userServiceMock: any;

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

  const mockAdminUser = {
    ...mockUser,
    id: 'admin-uuid',
    role: UserRole.ADMIN,
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
      const result = await controller.findAll(mockAdminRequest());

      // Assert
      expect(result).toEqual(expectedUsers.map(user => expect.any(User)));
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
      expect(result).toEqual(expect.any(User));
      expect(userServiceMock.findById).toHaveBeenCalledWith('test-uuid');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userServiceMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.findById('non-existent-uuid'))
        .rejects.toThrow(NotFoundException);
      expect(userServiceMock.findById).toHaveBeenCalledWith('non-existent-uuid');
    });
  });

  describe('getProfile', () => {
    it('should return the current user profile', async () => {
      // Arrange
      userServiceMock.findById.mockResolvedValue(mockUser);

      // Act
      const result = await controller.getProfile(mockRequest());

      // Assert
      expect(result).toEqual(expect.any(User));
      expect(userServiceMock.findById).toHaveBeenCalledWith('test-uuid');
    });

    it('should throw NotFoundException when profile not found', async () => {
      // Arrange
      userServiceMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getProfile(mockRequest()))
        .rejects.toThrow(NotFoundException);
      expect(userServiceMock.findById).toHaveBeenCalledWith('test-uuid');
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

      const createdUser = {
        ...mockUser,
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      };

      userServiceMock.create.mockResolvedValue(createdUser);

      // Act
      const result = await controller.create(createUserDto, mockAdminRequest());

      // Assert
      expect(result).toEqual(expect.any(User));
      expect(userServiceMock.create).toHaveBeenCalledWith(createUserDto);
    });

    it('should forbid non-admins from creating users with elevated privileges', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'new@example.playaplan.app',
        firstName: 'New',
        lastName: 'User',
        role: UserRole.ADMIN, // Trying to create admin
      };

      // Act & Assert
      await expect(controller.create(createUserDto, mockRequest()))
        .rejects.toThrow(ForbiddenException);
      expect(userServiceMock.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return the user', async () => {
      // Arrange
      const updateData: UpdateUserDto = { 
        firstName: 'Updated', 
        lastName: 'Name' 
      };
      
      const updatedUser = { ...mockUser, ...updateData };
      userServiceMock.findById.mockResolvedValue(mockUser);
      userServiceMock.update.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.update('test-uuid', updateData, mockRequest());

      // Assert
      expect(result).toEqual(expect.any(User));
      expect(userServiceMock.update).toHaveBeenCalledWith('test-uuid', updateData);
    });

    it('should forbid role updates by non-admins', async () => {
      // Arrange
      const updateData: UpdateUserDto = { 
        role: UserRole.ADMIN // Trying to become admin
      };
      
      userServiceMock.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(controller.update('test-uuid', updateData, mockRequest()))
        .rejects.toThrow(ForbiddenException);
      expect(userServiceMock.update).not.toHaveBeenCalled();
    });

    it('should pass through NotFoundException from service', async () => {
      // Arrange
      const updateData: UpdateUserDto = { firstName: 'Updated' };
      // Set findById to return null so the controller will throw NotFoundException
      userServiceMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.update('non-existent-id', updateData, mockAdminRequest()))
        .rejects.toThrow(NotFoundException);
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

  describe('adminTest', () => {
    it('should return success message for admins', async () => {
      // Act
      const result = await controller.adminTest();

      // Assert
      expect(result).toEqual({ message: 'Admin test successful' });
    });
  });
});