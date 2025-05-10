import { Test, TestingModule } from '@nestjs/testing';
import { CampingOptionsService } from './camping-options.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CampingOption } from '../entities/camping-option.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateCampingOptionDto, UpdateCampingOptionDto } from '../dto';

describe('CampingOptionsService', () => {
  let service: CampingOptionsService;
  let prisma: PrismaService;

  const mockCampingOption = {
    id: 'test-id',
    name: 'Test Camping Option',
    description: 'Test description',
    enabled: true,
    workShiftsRequired: 1,
    participantDues: 100.00,
    staffDues: 50.00,
    maxSignups: 10,
    campId: 'camp-id',
    jobCategoryIds: ['category-1', 'category-2'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateCampingOptionDto: CreateCampingOptionDto = {
    name: 'Test Camping Option',
    description: 'Test description',
    enabled: true,
    workShiftsRequired: 1,
    participantDues: 100.00,
    staffDues: 50.00,
    maxSignups: 10,
    campId: 'camp-id',
    jobCategoryIds: ['category-1', 'category-2'],
  };

  const mockUpdateCampingOptionDto: UpdateCampingOptionDto = {
    name: 'Updated Camping Option',
    description: 'Updated description',
    enabled: false,
  };

  const mockPrismaService = {
    camp: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    jobCategory: {
      findMany: jest.fn(),
    },
    campingOption: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    campingOptionRegistration: {
      count: jest.fn(),
    },
    campingOptionField: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampingOptionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CampingOptionsService>(CampingOptionsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Default mock implementations for Prisma methods
    mockPrismaService.campingOption.create.mockResolvedValue(mockCampingOption);
    mockPrismaService.campingOption.findMany.mockResolvedValue([mockCampingOption]);
    mockPrismaService.campingOption.findUnique.mockResolvedValue(mockCampingOption);
    mockPrismaService.campingOption.update.mockResolvedValue(mockCampingOption);
    mockPrismaService.campingOption.delete.mockResolvedValue(mockCampingOption);
    mockPrismaService.campingOptionRegistration.count.mockResolvedValue(0);
    mockPrismaService.campingOptionField.count.mockResolvedValue(0);
    mockPrismaService.camp.findUnique.mockResolvedValue({ id: 'camp-id', name: 'Test Camp' });
    mockPrismaService.jobCategory.findMany.mockResolvedValue([
      { id: 'category-1', name: 'Category 1' },
      { id: 'category-2', name: 'Category 2' },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a camping option and return it', async () => {
      const result = await service.create(mockCreateCampingOptionDto);
      
      expect(prisma.camp.findUnique).toHaveBeenCalledWith({
        where: { id: mockCreateCampingOptionDto.campId },
      });
      
      expect(prisma.campingOption.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: mockCreateCampingOptionDto.name,
          description: mockCreateCampingOptionDto.description,
        }),
      });
      
      expect(result).toBeInstanceOf(CampingOption);
      expect(result.name).toEqual(mockCampingOption.name);
    });

    it('should assign the first active camp if campId is not provided', async () => {
      const dto = { ...mockCreateCampingOptionDto };
      delete dto.campId;
      const firstActiveCamp = {
        id: 'active-camp-id',
        name: 'Active Camp',
        description: 'A test active camp',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-10'),
        location: 'Test Location',
        capacity: 100,
        isActive: true,
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2023-12-02'),
      };
      // Override the campingOption.create mock for this test to return the correct campId
      const createSpy = jest.spyOn(prisma.campingOption, 'create').mockResolvedValueOnce({
        ...mockCampingOption,
        campId: 'active-camp-id',
      });
      const findFirstSpy = jest.spyOn(prisma.camp, 'findFirst').mockResolvedValueOnce(firstActiveCamp);
      const findUniqueSpy = jest.spyOn(prisma.camp, 'findUnique').mockResolvedValueOnce(firstActiveCamp);
      const result = await service.create(dto);
      expect(prisma.camp.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toBeInstanceOf(CampingOption);
      expect(result.campId).toBe('active-camp-id');
      // Restore the spies to avoid affecting other tests
      findFirstSpy.mockRestore();
      findUniqueSpy.mockRestore();
      createSpy.mockRestore();
    });

    it('should throw NotFoundException if no active camp exists and campId is not provided', async () => {
      const dto = { ...mockCreateCampingOptionDto };
      delete dto.campId;
      mockPrismaService.camp.findFirst = jest.fn().mockResolvedValueOnce(null);
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if camp not found', async () => {
      mockPrismaService.camp.findUnique.mockResolvedValueOnce(null);
      
      await expect(service.create(mockCreateCampingOptionDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if job categories not found', async () => {
      mockPrismaService.jobCategory.findMany.mockResolvedValueOnce([{ id: 'category-1', name: 'Category 1' }]);
      
      await expect(service.create(mockCreateCampingOptionDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if create fails', async () => {
      mockPrismaService.campingOption.create.mockRejectedValueOnce(new Error('Database error'));
      
      await expect(service.create(mockCreateCampingOptionDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return an array of camping options', async () => {
      const result = await service.findAll();
      
      expect(prisma.campingOption.findMany).toHaveBeenCalledWith({
        where: { enabled: true },
        orderBy: { name: 'asc' },
      });
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(CampingOption);
    });

    it('should respect includeDisabled parameter', async () => {
      await service.findAll(true);
      
      expect(prisma.campingOption.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by campId when provided', async () => {
      await service.findAll(false, 'camp-id');
      
      expect(prisma.campingOption.findMany).toHaveBeenCalledWith({
        where: { enabled: true, campId: 'camp-id' },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a camping option by id', async () => {
      const result = await service.findOne('test-id');
      
      expect(prisma.campingOption.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
      
      expect(result).toBeInstanceOf(CampingOption);
    });

    it('should throw NotFoundException if camping option not found', async () => {
      mockPrismaService.campingOption.findUnique.mockResolvedValueOnce(null);
      
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRegistrationCount', () => {
    it('should return the count of registrations for a camping option', async () => {
      mockPrismaService.campingOptionRegistration.count.mockResolvedValueOnce(5);
      
      const result = await service.getRegistrationCount('test-id');
      
      expect(prisma.campingOptionRegistration.count).toHaveBeenCalledWith({
        where: { campingOptionId: 'test-id' },
      });
      
      expect(result).toBe(5);
    });

    it('should return 0 if no registrations found', async () => {
      mockPrismaService.campingOptionRegistration.count.mockResolvedValueOnce(0);
      
      const result = await service.getRegistrationCount('test-id');
      
      expect(result).toBe(0);
    });
  });

  describe('update', () => {
    it('should update and return a camping option', async () => {
      const result = await service.update('test-id', mockUpdateCampingOptionDto);
      
      expect(prisma.campingOption.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
      
      expect(prisma.campingOption.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: expect.objectContaining({
          name: mockUpdateCampingOptionDto.name,
          description: mockUpdateCampingOptionDto.description,
          enabled: mockUpdateCampingOptionDto.enabled,
        }),
      });
      
      expect(result).toBeInstanceOf(CampingOption);
    });

    it('should throw NotFoundException if camping option not found', async () => {
      mockPrismaService.campingOption.findUnique.mockResolvedValueOnce(null);
      
      await expect(service.update('non-existent', mockUpdateCampingOptionDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a camping option and return it', async () => {
      const result = await service.remove('test-id');
      
      expect(prisma.campingOption.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
      
      expect(prisma.campingOptionRegistration.count).toHaveBeenCalledWith({
        where: { campingOptionId: 'test-id' },
      });
      
      expect(prisma.campingOptionField.count).toHaveBeenCalledWith({
        where: { campingOptionId: 'test-id' },
      });
      
      expect(prisma.campingOption.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
      
      expect(result).toBeInstanceOf(CampingOption);
    });

    it('should throw NotFoundException if camping option not found', async () => {
      mockPrismaService.campingOption.findUnique.mockResolvedValueOnce(null);
      
      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if there are registrations', async () => {
      mockPrismaService.campingOptionRegistration.count.mockResolvedValueOnce(5);
      
      await expect(service.remove('test-id')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if there are custom fields', async () => {
      mockPrismaService.campingOptionField.count.mockResolvedValueOnce(3);
      
      await expect(service.remove('test-id')).rejects.toThrow(BadRequestException);
    });
  });
}); 