import { Test, TestingModule } from '@nestjs/testing';
import { CampController } from './camp.controller';
import { CampsService } from '../services/camps.service';
import { UserRole } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Camp } from '@prisma/client';
import { CreateCampDto } from '../dto/create-camp.dto';
import { UpdateCampDto } from '../dto/update-camp.dto';

// Mock request objects for testing
const mockRequest = (role: UserRole = UserRole.PARTICIPANT) => {
  return {
    user: {
      id: 'user-123',
      email: 'user@example.com',
      role: role
    }
  };
};

describe('CampController', () => {
  let controller: CampController;
  let campsServiceMock: jest.Mocked<Partial<CampsService>>;

  const mockCamp: Camp = {
    id: 'camp-uuid-1',
    name: 'Test Camp',
    description: 'Test camp description',
    startDate: new Date('2025-08-25'),
    endDate: new Date('2025-09-01'),
    location: 'Test Location',
    capacity: 100,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Create a mock CampsService
    campsServiceMock = {
      findAll: jest.fn(),
      findCurrent: jest.fn(),
      findUpcoming: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      hasShifts: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampController],
      providers: [
        {
          provide: CampsService,
          useValue: campsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<CampController>(CampController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return an array of camps', async () => {
      // Arrange
      const expectedCamps = [mockCamp];
      campsServiceMock.findAll.mockResolvedValue(expectedCamps);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toMatchObject(expectedCamps.map(camp => ({
        id: camp.id,
        name: camp.name,
      })));
      expect(campsServiceMock.findAll).toHaveBeenCalledWith(false);
    });

    it('should include inactive camps when requested', async () => {
      // Arrange
      const expectedCamps = [mockCamp, { ...mockCamp, id: 'camp-2', isActive: false }];
      campsServiceMock.findAll.mockResolvedValue(expectedCamps);

      // Act
      const result = await controller.findAll(true);

      // Assert
      expect(result).toHaveLength(2);
      expect(campsServiceMock.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('findCurrent', () => {
    it('should return current active camps', async () => {
      // Arrange
      const expectedCamps = [mockCamp];
      campsServiceMock.findCurrent.mockResolvedValue(expectedCamps);

      // Act
      const result = await controller.findCurrent();

      // Assert
      expect(result).toMatchObject(expectedCamps.map(camp => ({
        id: camp.id,
        name: camp.name,
      })));
      expect(campsServiceMock.findCurrent).toHaveBeenCalled();
    });
  });

  describe('findUpcoming', () => {
    it('should return upcoming active camps', async () => {
      // Arrange
      const expectedCamps = [mockCamp];
      campsServiceMock.findUpcoming.mockResolvedValue(expectedCamps);

      // Act
      const result = await controller.findUpcoming();

      // Assert
      expect(result).toMatchObject(expectedCamps.map(camp => ({
        id: camp.id,
        name: camp.name,
      })));
      expect(campsServiceMock.findUpcoming).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a camp by ID', async () => {
      // Arrange
      campsServiceMock.findById.mockResolvedValue(mockCamp);

      // Act
      const result = await controller.findOne('camp-uuid-1');

      // Assert
      expect(result).toMatchObject({
        id: mockCamp.id,
        name: mockCamp.name,
      });
      expect(campsServiceMock.findById).toHaveBeenCalledWith('camp-uuid-1');
    });

    it('should throw NotFoundException when camp not found', async () => {
      // Arrange
      campsServiceMock.findById.mockRejectedValue(new NotFoundException('Camp not found'));

      // Act & Assert
      await expect(controller.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(campsServiceMock.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('create', () => {
    it('should create a new camp', async () => {
      // Arrange
      const createCampDto: CreateCampDto = {
        name: 'New Camp',
        description: 'New camp description',
        startDate: '2025-10-01T00:00:00.000Z',
        endDate: '2025-10-08T00:00:00.000Z',
        location: 'New Location',
        capacity: 150,
        isActive: true,
      };

      const expectedCamp = {
        ...mockCamp,
        ...createCampDto,
        startDate: new Date(createCampDto.startDate),
        endDate: new Date(createCampDto.endDate),
      };

      campsServiceMock.create.mockResolvedValue(expectedCamp);

      // Act
      const result = await controller.create(createCampDto);

      // Assert
      expect(result).toMatchObject({
        id: expectedCamp.id,
        name: expectedCamp.name,
        description: expectedCamp.description,
      });
      expect(campsServiceMock.create).toHaveBeenCalledWith(createCampDto);
    });
  });

  describe('update', () => {
    it('should update an existing camp', async () => {
      // Arrange
      const updateCampDto: UpdateCampDto = {
        name: 'Updated Camp',
        description: 'Updated description',
      };

      const expectedCamp = {
        ...mockCamp,
        ...updateCampDto,
      };

      campsServiceMock.update.mockResolvedValue(expectedCamp);

      // Act
      const result = await controller.update('camp-uuid-1', updateCampDto);

      // Assert
      expect(result).toMatchObject({
        id: expectedCamp.id,
        name: expectedCamp.name,
        description: expectedCamp.description,
      });
      expect(campsServiceMock.update).toHaveBeenCalledWith('camp-uuid-1', updateCampDto);
    });

    it('should throw NotFoundException when camp not found', async () => {
      // Arrange
      const updateCampDto: UpdateCampDto = {
        name: 'Updated Camp',
      };

      campsServiceMock.update.mockRejectedValue(new NotFoundException('Camp not found'));

      // Act & Assert
      await expect(controller.update('non-existent-id', updateCampDto)).rejects.toThrow(
        NotFoundException
      );
      expect(campsServiceMock.update).toHaveBeenCalledWith('non-existent-id', updateCampDto);
    });
  });

  describe('delete', () => {
    it('should delete camp when it has no shifts', async () => {
      // Arrange
      campsServiceMock.hasShifts.mockResolvedValue(false);
      campsServiceMock.delete.mockResolvedValue(mockCamp);

      // Act
      await controller.delete('camp-uuid-1');

      // Assert
      expect(campsServiceMock.hasShifts).toHaveBeenCalledWith('camp-uuid-1');
      expect(campsServiceMock.delete).toHaveBeenCalledWith('camp-uuid-1');
    });

    it('should throw ForbiddenException when camp has shifts', async () => {
      // Arrange
      campsServiceMock.hasShifts.mockResolvedValue(true);

      // Act & Assert
      await expect(controller.delete('camp-uuid-1')).rejects.toThrow(
        ForbiddenException
      );
      expect(campsServiceMock.hasShifts).toHaveBeenCalledWith('camp-uuid-1');
      expect(campsServiceMock.delete).not.toHaveBeenCalled();
    });
  });

  describe('adminTest', () => {
    it('should return a success message', async () => {
      // Act
      const result = await controller.adminTest();

      // Assert
      expect(result).toEqual({ message: 'Camp controller test successful' });
    });
  });
});