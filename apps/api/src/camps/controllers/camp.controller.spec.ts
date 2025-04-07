import { Test, TestingModule } from '@nestjs/testing';
import { CampController } from './camp.controller';
import { CampsService } from '../services/camps.service';
import { UserRole } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Camp } from '@prisma/client';
import { CreateCampDto } from '../dto/create-camp.dto';
import { UpdateCampDto } from '../dto/update-camp.dto';

describe('CampController', () => {
  let controller: CampController;
  let campsService: jest.Mocked<CampsService>;

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
    // Create a mock CampsService with all methods
    const mockCampsService = {
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
          useValue: mockCampsService,
        },
      ],
    }).compile();

    controller = module.get<CampController>(CampController);
    campsService = module.get<CampsService>(CampsService) as jest.Mocked<CampsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return an array of camps', async () => {
      // Arrange
      const expectedCamps = [mockCamp];
      campsService.findAll.mockResolvedValue(expectedCamps);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toMatchObject(expectedCamps);
      expect(campsService.findAll).toHaveBeenCalledWith(false);
    });

    it('should include inactive camps when requested', async () => {
      // Arrange
      const expectedCamps = [mockCamp, { ...mockCamp, id: 'camp-2', isActive: false }];
      campsService.findAll.mockResolvedValue(expectedCamps);

      // Act
      const result = await controller.findAll(true);

      // Assert
      expect(result).toHaveLength(2);
      expect(campsService.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('findCurrent', () => {
    it('should return current active camps', async () => {
      // Arrange
      const expectedCamps = [mockCamp];
      campsService.findCurrent.mockResolvedValue(expectedCamps);

      // Act
      const result = await controller.findCurrent();

      // Assert
      expect(result).toMatchObject(expectedCamps);
      expect(campsService.findCurrent).toHaveBeenCalled();
    });
  });

  describe('findUpcoming', () => {
    it('should return upcoming active camps', async () => {
      // Arrange
      const expectedCamps = [mockCamp];
      campsService.findUpcoming.mockResolvedValue(expectedCamps);

      // Act
      const result = await controller.findUpcoming();

      // Assert
      expect(result).toMatchObject(expectedCamps);
      expect(campsService.findUpcoming).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a camp by ID', async () => {
      // Arrange
      campsService.findById.mockResolvedValue(mockCamp);

      // Act
      const result = await controller.findOne('camp-uuid-1');

      // Assert
      expect(result).toMatchObject(mockCamp);
      expect(campsService.findById).toHaveBeenCalledWith('camp-uuid-1');
    });

    it('should throw NotFoundException when camp not found', async () => {
      // Arrange
      campsService.findById.mockRejectedValue(new NotFoundException('Camp not found'));

      // Act & Assert
      await expect(controller.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(campsService.findById).toHaveBeenCalledWith('non-existent-id');
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

      campsService.create.mockResolvedValue(expectedCamp);

      // Act
      const result = await controller.create(createCampDto);

      // Assert
      expect(result).toMatchObject(expectedCamp);
      expect(campsService.create).toHaveBeenCalledWith(createCampDto);
    });
  });

  describe('update', () => {
    it('should update an existing camp', async () => {
      // Arrange
      const updateCampDto = {
        name: 'Updated Camp',
        description: 'Updated description',
      } as const;

      const expectedCamp = {
        ...mockCamp,
        name: updateCampDto.name,
        description: updateCampDto.description,
      };

      campsService.update.mockResolvedValue(expectedCamp);

      // Act
      const result = await controller.update('camp-uuid-1', updateCampDto);

      // Assert
      expect(result).toMatchObject(expectedCamp);
      expect(campsService.update).toHaveBeenCalledWith('camp-uuid-1', updateCampDto);
    });

    it('should throw NotFoundException when camp not found', async () => {
      // Arrange
      const updateCampDto: UpdateCampDto = {
        name: 'Updated Camp',
      };

      campsService.update.mockRejectedValue(new NotFoundException('Camp not found'));

      // Act & Assert
      await expect(controller.update('non-existent-id', updateCampDto)).rejects.toThrow(
        NotFoundException
      );
      expect(campsService.update).toHaveBeenCalledWith('non-existent-id', updateCampDto);
    });
  });

  describe('delete', () => {
    it('should delete camp when it has no shifts', async () => {
      // Arrange
      campsService.hasShifts.mockResolvedValue(false);
      campsService.delete.mockResolvedValue(mockCamp);

      // Act
      await controller.delete('camp-uuid-1');

      // Assert
      expect(campsService.hasShifts).toHaveBeenCalledWith('camp-uuid-1');
      expect(campsService.delete).toHaveBeenCalledWith('camp-uuid-1');
    });

    it('should throw ForbiddenException when camp has shifts', async () => {
      // Arrange
      campsService.hasShifts.mockResolvedValue(true);

      // Act & Assert
      await expect(controller.delete('camp-uuid-1')).rejects.toThrow(
        ForbiddenException
      );
      expect(campsService.hasShifts).toHaveBeenCalledWith('camp-uuid-1');
      expect(campsService.delete).not.toHaveBeenCalled();
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