import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    job: {
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
        JobsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a job', async () => {
      const createJobDto: CreateJobDto = {
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
        staffOnly: false,
        alwaysRequired: true,
      };

      const expectedJob = {
        id: 'test-id',
        ...createJobDto,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'test-category-id',
          name: 'Test Category',
          description: 'Test Category Description',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockPrismaService.job.create.mockResolvedValue(expectedJob);

      const result = await service.create(createJobDto);

      expect(result).toEqual(expectedJob);
      expect(mockPrismaService.job.create).toHaveBeenCalledWith({
        data: createJobDto,
        include: {
          category: true,
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return all jobs', async () => {
      const expectedJobs = [
        {
          id: 'test-id-1',
          name: 'Test Job 1',
          description: 'Test Description 1',
          location: 'Test Location 1',
          categoryId: 'test-category-id-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          category: {
            id: 'test-category-id-1',
            name: 'Test Category 1',
            description: 'Test Category Description 1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'test-id-2',
          name: 'Test Job 2',
          description: 'Test Description 2',
          location: 'Test Location 2',
          categoryId: 'test-category-id-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          category: {
            id: 'test-category-id-2',
            name: 'Test Category 2',
            description: 'Test Category Description 2',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      mockPrismaService.job.findMany.mockResolvedValue(expectedJobs);

      const result = await service.findAll();

      expect(result).toEqual(expectedJobs);
      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        include: {
          category: true,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a job by id', async () => {
      const jobId = 'test-id';
      const expectedJob = {
        id: jobId,
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'test-category-id',
          name: 'Test Category',
          description: 'Test Category Description',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockPrismaService.job.findUnique.mockResolvedValue(expectedJob);

      const result = await service.findOne(jobId);

      expect(result).toEqual(expectedJob);
      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: jobId },
        include: {
          category: true,
        },
      });
    });

    it('should throw NotFoundException if job not found', async () => {
      const jobId = 'non-existent-id';
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(service.findOne(jobId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a job', async () => {
      const jobId = 'test-id';
      const updateJobDto: UpdateJobDto = {
        name: 'Updated Job',
        description: 'Updated Description',
        location: 'Updated Location',
        staffOnly: true,
        alwaysRequired: false,
      };

      const expectedJob = {
        id: jobId,
        ...updateJobDto,
        categoryId: 'test-category-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'test-category-id',
          name: 'Test Category',
          description: 'Test Category Description',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockPrismaService.job.update.mockResolvedValue(expectedJob);

      const result = await service.update(jobId, updateJobDto);

      expect(result).toEqual(expectedJob);
      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: updateJobDto,
        include: {
          category: true,
        },
      });
    });

    it('should throw NotFoundException if job not found', async () => {
      const jobId = 'non-existent-id';
      const updateJobDto = {
        name: 'Updated Job',
      };

      mockPrismaService.job.update.mockRejectedValue(new Error());

      await expect(service.update(jobId, updateJobDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a job', async () => {
      const jobId = 'test-id';
      const expectedJob = {
        id: jobId,
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.job.delete.mockResolvedValue(expectedJob);

      const result = await service.remove(jobId);

      expect(result).toEqual(expectedJob);
      expect(mockPrismaService.job.delete).toHaveBeenCalledWith({
        where: { id: jobId },
      });
    });

    it('should throw NotFoundException if job not found', async () => {
      const jobId = 'non-existent-id';
      mockPrismaService.job.delete.mockRejectedValue(new Error());

      await expect(service.remove(jobId)).rejects.toThrow(NotFoundException);
    });
  });
}); 