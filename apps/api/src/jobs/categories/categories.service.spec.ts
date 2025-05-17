import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaService: PrismaService;

  // Mock data
  const mockCategories = [
    {
      id: '1',
      name: 'Test Category 1',
      description: 'Test Description 1',
      staffOnly: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      alwaysRequired: false,
      location: null,
      jobs: [],
    },
    {
      id: '2',
      name: 'Test Category 2',
      description: 'Test Description 2',
      staffOnly: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      alwaysRequired: false,
      location: null,
      jobs: [],
    },
  ];

  // Create mock Prisma service
  const mockPrismaService = {
    jobCategory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mock implementation for each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new job category with staffOnly=false by default', async () => {
      const createDto = {
        name: 'New Category',
        description: 'New Description',
      };

      const expectedResult = {
        id: '3',
        name: 'New Category',
        description: 'New Description',
        staffOnly: false, // Default value when not provided
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        alwaysRequired: false,
        location: null,
      };

      mockPrismaService.jobCategory.create.mockResolvedValue(expectedResult);

      const result = await service.create(createDto);
      
      expect(mockPrismaService.jobCategory.create).toHaveBeenCalledWith({
        data: createDto,
      });
      expect(result).toEqual(expectedResult);
    });

    it('should create a job category with staffOnly=true when specified', async () => {
      const createDto = {
        name: 'Staff Category',
        description: 'Staff Only Description',
        staffOnly: true,
      };

      const expectedResult = {
        id: '4',
        name: 'Staff Category',
        description: 'Staff Only Description',
        staffOnly: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        alwaysRequired: false,
        location: null,
      };

      mockPrismaService.jobCategory.create.mockResolvedValue(expectedResult);

      const result = await service.create(createDto);
      
      expect(mockPrismaService.jobCategory.create).toHaveBeenCalledWith({
        data: createDto,
      });
      expect(result).toEqual(expectedResult);
      expect(result.staffOnly).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return an array of job categories including staffOnly field', async () => {
      mockPrismaService.jobCategory.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll();
      
      expect(mockPrismaService.jobCategory.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockCategories);
      expect(result[0].staffOnly).toBe(false);
      expect(result[1].staffOnly).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return a single job category with staffOnly field', async () => {
      mockPrismaService.jobCategory.findUnique.mockResolvedValue(mockCategories[1]);

      const result = await service.findOne('2');
      
      expect(mockPrismaService.jobCategory.findUnique).toHaveBeenCalledWith({
        where: { id: '2' },
        include: { jobs: true },
      });
      expect(result).toEqual(mockCategories[1]);
      expect(result.staffOnly).toBe(true);
    });

    it('should throw NotFoundException when category not found', async () => {
      mockPrismaService.jobCategory.findUnique.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a job category including the staffOnly field', async () => {
      const updateDto = {
        staffOnly: true,
        description: 'Updated description',
      };

      const updatedCategory = {
        ...mockCategories[0],
        staffOnly: true,
        description: 'Updated description',
      };

      mockPrismaService.jobCategory.update.mockResolvedValue(updatedCategory);

      const result = await service.update('1', updateDto);
      
      expect(mockPrismaService.jobCategory.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateDto,
        include: { jobs: true },
      });
      expect(result).toEqual(updatedCategory);
      expect(result.staffOnly).toBe(true);
    });

    it('should throw NotFoundException when trying to update non-existent category', async () => {
      mockPrismaService.jobCategory.update.mockRejectedValue(new Error());

      await expect(service.update('999', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a job category', async () => {
      mockPrismaService.jobCategory.delete.mockResolvedValue(mockCategories[0]);

      const result = await service.remove('1');
      
      expect(mockPrismaService.jobCategory.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toEqual(mockCategories[0]);
    });

    it('should throw NotFoundException when trying to delete non-existent category', async () => {
      const error = new Error();
      Object.defineProperty(error, 'code', { value: 'P2025' });
      mockPrismaService.jobCategory.delete.mockRejectedValue(error);

      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when category is in use', async () => {
      const error = new Error();
      Object.defineProperty(error, 'code', { value: 'P2003' });
      mockPrismaService.jobCategory.delete.mockRejectedValue(error);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
    });
  });
}); 