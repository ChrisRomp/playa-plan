import { Test, TestingModule } from '@nestjs/testing';
import { CampsService } from './camps.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Camp } from '@prisma/client';
import { CreateCampDto } from '../dto/create-camp.dto';
import { UpdateCampDto } from '../dto/update-camp.dto';

describe('CampsService', () => {
  let service: CampsService;
  let prismaServiceMock: any;
  let realDate: DateConstructor;

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
    // Store the original Date constructor
    realDate = global.Date;

    // Create a mock PrismaService with all required methods
    prismaServiceMock = {
      camp: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      shift: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampsService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<CampsService>(CampsService);
  });

  afterEach(() => {
    // Restore original Date constructor
    global.Date = realDate;
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return active camps by default', async () => {
      // Arrange
      const expectedCamps = [mockCamp];
      prismaServiceMock.camp.findMany.mockResolvedValue(expectedCamps);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(expectedCamps);
      expect(prismaServiceMock.camp.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { startDate: 'asc' },
      });
    });

    it('should include inactive camps when specified', async () => {
      // Arrange
      const expectedCamps = [mockCamp, { ...mockCamp, id: 'camp-2', isActive: false }];
      prismaServiceMock.camp.findMany.mockResolvedValue(expectedCamps);

      // Act
      const result = await service.findAll(true);

      // Assert
      expect(result).toEqual(expectedCamps);
      expect(prismaServiceMock.camp.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { startDate: 'asc' },
      });
    });
  });

  describe('findUpcoming', () => {
    it('should return upcoming active camps', async () => {
      // Arrange
      const expectedCamps = [mockCamp];
      prismaServiceMock.camp.findMany.mockResolvedValue(expectedCamps);

      // Mock Date.now() instead of the entire Date constructor
      const mockCurrentDate = new Date('2025-08-20').getTime();
      jest.spyOn(Date, 'now').mockImplementation(() => mockCurrentDate);

      // Act
      const result = await service.findUpcoming();

      // Assert
      expect(result).toEqual(expectedCamps);
      expect(prismaServiceMock.camp.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          startDate: {
            gt: expect.any(Date),
          },
        },
        orderBy: { startDate: 'asc' },
      });
    });
  });

  describe('findCurrent', () => {
    it('should return active camps that are currently running', async () => {
      // Arrange
      const expectedCamps = [mockCamp];
      prismaServiceMock.camp.findMany.mockResolvedValue(expectedCamps);

      // Mock Date.now() instead of the entire Date constructor
      const mockCurrentDate = new Date('2025-08-26').getTime();
      jest.spyOn(Date, 'now').mockImplementation(() => mockCurrentDate);

      // Act
      const result = await service.findCurrent();

      // Assert
      expect(result).toEqual(expectedCamps);
      expect(prismaServiceMock.camp.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          startDate: {
            lte: expect.any(Date),
          },
          endDate: {
            gte: expect.any(Date),
          },
        },
      });
    });
  });

  describe('findById', () => {
    it('should return a camp when it exists', async () => {
      // Arrange
      prismaServiceMock.camp.findUnique.mockResolvedValue(mockCamp);

      // Act
      const result = await service.findById('camp-uuid-1');

      // Assert
      expect(result).toEqual(mockCamp);
      expect(prismaServiceMock.camp.findUnique).toHaveBeenCalledWith({
        where: { id: 'camp-uuid-1' },
      });
    });

    it('should throw NotFoundException when camp does not exist', async () => {
      // Arrange
      prismaServiceMock.camp.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(prismaServiceMock.camp.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
    });
  });

  describe('create', () => {
    it('should create and return a camp', async () => {
      // Arrange
      const createCampDto: CreateCampDto = {
        name: 'New Camp',
        description: 'New camp description',
        startDate: '2025-08-25T00:00:00.000Z',
        endDate: '2025-09-01T00:00:00.000Z',
        location: 'New Location',
        capacity: 100,
        isActive: true,
      };

      prismaServiceMock.camp.create.mockResolvedValue({
        ...mockCamp,
        name: createCampDto.name,
        description: createCampDto.description,
        startDate: new Date(createCampDto.startDate),
        endDate: new Date(createCampDto.endDate),
        location: createCampDto.location,
      });

      // Act
      const result = await service.create(createCampDto);

      // Assert
      expect(result).toMatchObject({
        name: createCampDto.name,
        description: createCampDto.description,
        location: createCampDto.location,
      });
      expect(prismaServiceMock.camp.create).toHaveBeenCalledWith({
        data: {
          ...createCampDto,
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        },
      });
    });

    it('should throw ConflictException when start date is after end date', async () => {
      // Arrange
      const createCampDto: CreateCampDto = {
        name: 'New Camp',
        description: 'New camp description',
        startDate: '2025-09-01T00:00:00.000Z',
        endDate: '2025-08-25T00:00:00.000Z', // End date before start date
        location: 'New Location',
        capacity: 100,
        isActive: true,
      };

      // Act & Assert
      await expect(service.create(createCampDto)).rejects.toThrow(ConflictException);
      expect(prismaServiceMock.camp.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return a camp', async () => {
      // Arrange
      const updateCampDto: UpdateCampDto = {
        name: 'Updated Camp',
        description: 'Updated description',
      };

      // Mock the findById method for the initial check
      prismaServiceMock.camp.findUnique.mockResolvedValue(mockCamp);
      prismaServiceMock.camp.update.mockResolvedValue({
        ...mockCamp,
        ...updateCampDto,
      });

      // Act
      const result = await service.update('camp-uuid-1', updateCampDto);

      // Assert
      expect(result).toMatchObject({
        ...mockCamp,
        ...updateCampDto,
      });
      expect(prismaServiceMock.camp.update).toHaveBeenCalledWith({
        where: { id: 'camp-uuid-1' },
        data: updateCampDto,
      });
    });

    it('should update dates if provided and valid', async () => {
      // Arrange
      const updateCampDto: UpdateCampDto = {
        startDate: '2025-08-20T00:00:00.000Z', // Earlier start date
        endDate: '2025-09-05T00:00:00.000Z', // Later end date
      };

      const startDate = new Date(updateCampDto.startDate as string);
      const endDate = new Date(updateCampDto.endDate as string);

      // Mock the findById method for the initial check
      prismaServiceMock.camp.findUnique.mockResolvedValue(mockCamp);
      prismaServiceMock.camp.update.mockResolvedValue({
        ...mockCamp,
        startDate,
        endDate,
      });

      // Act
      const result = await service.update('camp-uuid-1', updateCampDto);

      // Assert
      expect(result).toMatchObject({
        ...mockCamp,
        startDate,
        endDate,
      });
      expect(prismaServiceMock.camp.update).toHaveBeenCalledWith({
        where: { id: 'camp-uuid-1' },
        data: {
          startDate,
          endDate,
        },
      });
    });

    it('should throw NotFoundException when camp does not exist', async () => {
      // Arrange
      const updateCampDto: UpdateCampDto = {
        name: 'Updated Camp',
      };

      // Mock the findById method to throw NotFoundException
      prismaServiceMock.camp.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent-id', updateCampDto)).rejects.toThrow(
        NotFoundException
      );
      expect(prismaServiceMock.camp.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when provided dates are invalid', async () => {
      // Arrange
      const updateCampDto: UpdateCampDto = {
        startDate: '2025-09-05T00:00:00.000Z', // Start date after current end date
      };

      // Mock the findById method for the initial check
      prismaServiceMock.camp.findUnique.mockImplementation((params: any) => {
        if (params.where.id === 'camp-uuid-1') {
          return mockCamp;
        }
        if (params.select && params.select.endDate) {
          return { endDate: mockCamp.endDate };
        }
        return null;
      });

      // Act & Assert
      await expect(service.update('camp-uuid-1', updateCampDto)).rejects.toThrow(
        ConflictException
      );
      expect(prismaServiceMock.camp.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete and return a camp', async () => {
      // Arrange
      prismaServiceMock.camp.findUnique.mockResolvedValue(mockCamp);
      prismaServiceMock.camp.delete.mockResolvedValue(mockCamp);

      // Act
      const result = await service.delete('camp-uuid-1');

      // Assert
      expect(result).toEqual(mockCamp);
      expect(prismaServiceMock.camp.findUnique).toHaveBeenCalledWith({
        where: { id: 'camp-uuid-1' },
      });
      expect(prismaServiceMock.camp.delete).toHaveBeenCalledWith({
        where: { id: 'camp-uuid-1' },
      });
    });

    it('should throw NotFoundException when camp does not exist', async () => {
      // Arrange
      prismaServiceMock.camp.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent-id')).rejects.toThrow(
        NotFoundException
      );
      expect(prismaServiceMock.camp.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
      expect(prismaServiceMock.camp.delete).not.toHaveBeenCalled();
    });
  });

  describe('hasShifts', () => {
    it('should return true when camp has shifts', async () => {
      // Arrange
      prismaServiceMock.shift.count.mockResolvedValue(3);

      // Act
      const result = await service.hasShifts('camp-uuid-1');

      // Assert
      expect(result).toBe(true);
      expect(prismaServiceMock.shift.count).toHaveBeenCalledWith({
        where: { campId: 'camp-uuid-1' },
      });
    });

    it('should return false when camp has no shifts', async () => {
      // Arrange
      prismaServiceMock.shift.count.mockResolvedValue(0);

      // Act
      const result = await service.hasShifts('camp-uuid-1');

      // Assert
      expect(result).toBe(false);
      expect(prismaServiceMock.shift.count).toHaveBeenCalledWith({
        where: { campId: 'camp-uuid-1' },
      });
    });
  });
});