import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CampingOptionsService } from './camping-options.service';
import { CreateCampingOptionDto, UpdateCampingOptionDto } from '../dto';
import { CampingOption } from '../entities/camping-option.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

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
    },
    jobCategory: {
      findMany: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $queryRaw: jest.fn(),
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

    // Default mock implementation for $queryRawUnsafe 
    mockPrismaService.$queryRawUnsafe.mockResolvedValue([mockCampingOption]);
    // Default mock implementation for $queryRaw 
    mockPrismaService.$queryRaw.mockResolvedValue([mockCampingOption]);
    // Default mock implementation for findUnique 
    mockPrismaService.camp.findUnique.mockResolvedValue({ id: 'camp-id', name: 'Test Camp' });
    // Default mock implementation for findMany 
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
      
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CampingOption);
      expect(result.name).toEqual(mockCampingOption.name);
    });

    it('should throw NotFoundException if camp not found', async () => {
      mockPrismaService.camp.findUnique.mockResolvedValueOnce(null);
      
      await expect(service.create(mockCreateCampingOptionDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if job categories not found', async () => {
      mockPrismaService.jobCategory.findMany.mockResolvedValueOnce([{ id: 'category-1', name: 'Category 1' }]);
      
      await expect(service.create(mockCreateCampingOptionDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if query fails', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValueOnce(null);
      
      await expect(service.create(mockCreateCampingOptionDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return an array of camping options', async () => {
      const result = await service.findAll();
      
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(CampingOption);
    });

    it('should respect includeDisabled parameter', async () => {
      await service.findAll(true);
      
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM "camping_options" WHERE 1=1'),
      );
    });

    it('should filter by campId when provided', async () => {
      await service.findAll(false, 'camp-id');
      
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining(`"campId" = 'camp-id'`),
      );
    });
  });

  describe('findOne', () => {
    it('should return a camping option by id', async () => {
      const result = await service.findOne('test-id');
      
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CampingOption);
    });

    it('should throw NotFoundException if camping option not found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([]);
      
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRegistrationCount', () => {
    it('should return the count of registrations for a camping option', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([{ count: '5' }]);
      
      const result = await service.getRegistrationCount('test-id');
      
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toBe(5);
    });

    it('should return 0 if no registrations found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([]);
      
      const result = await service.getRegistrationCount('test-id');
      
      expect(result).toBe(0);
    });
  });

  describe('update', () => {
    it('should update and return a camping option', async () => {
      const result = await service.update('test-id', mockUpdateCampingOptionDto);
      
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CampingOption);
    });

    it('should throw NotFoundException if camping option not found', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValueOnce(new NotFoundException());
      
      await expect(service.update('non-existent', mockUpdateCampingOptionDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a camping option and return it', async () => {
      const result = await service.remove('test-id');
      
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toBeInstanceOf(CampingOption);
    });

    it('should throw NotFoundException if camping option not found', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([mockCampingOption]) // First call in findOne
        .mockResolvedValueOnce([{ count: '1' }]); // Second call checks for registrations
      
      await expect(service.remove('test-id')).rejects.toThrow(BadRequestException);
    });
  });
}); 