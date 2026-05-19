import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, Request } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from '../services/user.service';
import { UserRole } from '@prisma/client';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';

/**
 * Type definition for authenticated request in tests
 */
interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

// Mock the Request object
const mockRequest = (): AuthRequest => {
  const req = {} as AuthRequest;
  req.user = {
    id: 'test-uuid',
    email: 'test@example.playaplan.app',
    role: UserRole.PARTICIPANT
  };
  return req;
};

const mockAdminRequest = (): AuthRequest => {
  const req = {} as AuthRequest;
  req.user = {
    id: 'admin-uuid',
    email: 'admin@example.playaplan.app',
    role: UserRole.ADMIN
  };
  return req;
};

const mockStaffRequest = (): AuthRequest => {
  const req = {} as AuthRequest;
  req.user = {
    id: 'staff-uuid',
    email: 'staff@example.playaplan.app',
    role: UserRole.STAFF
  };
  return req;
};

// Common test data
const updateDataFirstName: UpdateUserDto = { firstName: 'Updated' };

describe('UserController', () => {
  let controller: UserController;
  let userServiceMock: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findByEmail: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

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

  const mockStaffUser = {
    ...mockUser,
    id: 'staff-uuid',
    email: 'staff@example.playaplan.app',
    role: UserRole.STAFF,
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
      expect(result).toEqual(expectedUsers.map(() => expect.any(User)));
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

    it('should forbid role field even when set to same role by non-admin', async () => {
      // Arrange - the 'in' check catches any presence of the role key
      const updateData: UpdateUserDto = {
        role: UserRole.PARTICIPANT,
      };

      userServiceMock.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(controller.update('test-uuid', updateData, mockRequest()))
        .rejects.toThrow(ForbiddenException);
      expect(userServiceMock.update).not.toHaveBeenCalled();
    });

    it('should pass through NotFoundException from service', async () => {
      // Arrange
      const updateData = updateDataFirstName;
      // Set findById to return null so the controller will throw NotFoundException
      userServiceMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.update('non-existent-id', updateData, mockAdminRequest()))
        .rejects.toThrow(NotFoundException);
    });

    it('should allow staff to update their own profile', async () => {
      // Arrange - staff user updating their own profile
      const updateData = updateDataFirstName;
      const updatedStaffUser = { ...mockStaffUser, ...updateData };
      
      userServiceMock.findById.mockResolvedValue(mockStaffUser);
      userServiceMock.update.mockResolvedValue(updatedStaffUser);

      // Act
      const result = await controller.update('staff-uuid', updateData, mockStaffRequest());

      // Assert
      expect(result).toEqual(expect.any(User));
      expect(userServiceMock.update).toHaveBeenCalledWith('staff-uuid', updateData);
    });

    it('should forbid staff from updating other staff accounts', async () => {
      // Arrange - staff user trying to update another staff user
      const updateData = updateDataFirstName;
      const otherStaffUser = { 
        ...mockStaffUser, 
        id: 'other-staff-uuid',
        email: 'other-staff@example.playaplan.app'
      };
      
      userServiceMock.findById.mockResolvedValue(otherStaffUser);

      // Act & Assert
      await expect(controller.update('other-staff-uuid', updateData, mockStaffRequest()))
        .rejects.toThrow(ForbiddenException);
      expect(userServiceMock.update).not.toHaveBeenCalled();
    });

    it('should forbid staff from updating admin accounts', async () => {
      // Arrange - staff user trying to update admin user
      const updateData = updateDataFirstName;
      
      userServiceMock.findById.mockResolvedValue(mockAdminUser);

      // Act & Assert
      await expect(controller.update('admin-uuid', updateData, mockStaffRequest()))
        .rejects.toThrow(ForbiddenException);
      expect(userServiceMock.update).not.toHaveBeenCalled();
    });

    it('should allow staff to update participant accounts', async () => {
      // Arrange - staff user updating participant
      const updateData = updateDataFirstName;
      const updatedUser = { ...mockUser, ...updateData };
      
      userServiceMock.findById.mockResolvedValue(mockUser);
      userServiceMock.update.mockResolvedValue(updatedUser);

      // Act
      const result = await controller.update('test-uuid', updateData, mockStaffRequest());

      // Assert
      expect(result).toEqual(expect.any(User));
      expect(userServiceMock.update).toHaveBeenCalledWith('test-uuid', updateData);
    });

    it('should strip admin-only fields when participant updates own profile', async () => {
      // Arrange - participant tries to escalate with admin-only flags
      const updateData: UpdateUserDto = {
        firstName: 'Updated',
        allowRegistration: true,
        allowEarlyRegistration: true,
        allowDeferredDuesPayment: true,
        allowNoJob: true,
      };

      const updatedUser = { ...mockUser, firstName: 'Updated' };
      userServiceMock.findById.mockResolvedValue(mockUser);
      userServiceMock.update.mockResolvedValue(updatedUser);

      // Act
      await controller.update('test-uuid', updateData, mockRequest());

      // Assert - service should receive DTO WITHOUT admin-only fields
      expect(userServiceMock.update).toHaveBeenCalledWith('test-uuid', { firstName: 'Updated' });
    });

    it('should strip admin-only fields when staff updates a participant', async () => {
      // Arrange - staff tries to set admin-only flags on a participant
      const updateData: UpdateUserDto = {
        firstName: 'Updated',
        allowDeferredDuesPayment: true,
        allowNoJob: true,
      };

      const updatedUser = { ...mockUser, firstName: 'Updated' };
      userServiceMock.findById.mockResolvedValue(mockUser);
      userServiceMock.update.mockResolvedValue(updatedUser);

      // Act
      await controller.update('test-uuid', updateData, mockStaffRequest());

      // Assert - service should receive DTO WITHOUT admin-only fields
      expect(userServiceMock.update).toHaveBeenCalledWith('test-uuid', { firstName: 'Updated' });
    });

    it('should allow admin to set admin-only fields on update', async () => {
      // Arrange - admin sets permission flags
      const updateData: UpdateUserDto = {
        firstName: 'Updated',
        allowRegistration: false,
        allowEarlyRegistration: true,
        allowDeferredDuesPayment: true,
        allowNoJob: true,
      };

      const updatedUser = { ...mockUser, ...updateData };
      userServiceMock.findById.mockResolvedValue(mockUser);
      userServiceMock.update.mockResolvedValue(updatedUser);

      // Act
      await controller.update('test-uuid', updateData, mockAdminRequest());

      // Assert - service should receive the FULL DTO including admin fields
      expect(userServiceMock.update).toHaveBeenCalledWith('test-uuid', updateData);
    });
  });

  describe('create - admin field protection', () => {
    it('should strip admin-only fields when non-admin creates a user', async () => {
      // Arrange - participant creates user with admin-only flags
      const createUserDto: CreateUserDto = {
        email: 'new@example.playaplan.app',
        firstName: 'New',
        lastName: 'User',
        allowRegistration: false,
        allowEarlyRegistration: true,
        allowDeferredDuesPayment: true,
        allowNoJob: true,
      };

      const createdUser = {
        ...mockUser,
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      };
      userServiceMock.create.mockResolvedValue(createdUser);

      // Act
      await controller.create(createUserDto, mockRequest());

      // Assert - service should receive DTO WITHOUT admin-only fields
      expect(userServiceMock.create).toHaveBeenCalledWith({
        email: 'new@example.playaplan.app',
        firstName: 'New',
        lastName: 'User',
      });
    });

    it('should allow admin to set admin-only fields on create', async () => {
      // Arrange - admin creates user with permission flags
      const createUserDto: CreateUserDto = {
        email: 'new@example.playaplan.app',
        firstName: 'New',
        lastName: 'User',
        allowRegistration: false,
        allowEarlyRegistration: true,
        allowDeferredDuesPayment: true,
        allowNoJob: true,
      };

      const createdUser = { ...mockUser, ...createUserDto };
      userServiceMock.create.mockResolvedValue(createdUser);

      // Act
      await controller.create(createUserDto, mockAdminRequest());

      // Assert - service should receive the FULL DTO including admin fields
      expect(userServiceMock.create).toHaveBeenCalledWith(createUserDto);
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