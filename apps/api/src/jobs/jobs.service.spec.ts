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
        shiftId: 'test-shift-id',
      };

      const mockJob = {
        id: 'test-id',
        ...createJobDto,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'test-category-id',
          name: 'Test Category',
          description: 'Test Category Description',
          staffOnly: false,
          alwaysRequired: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        shift: {
          id: 'test-shift-id',
          name: 'Test Shift',
          description: 'Test Shift Description',
          startTime: new Date(),
          endTime: new Date(),
          maxRegistrations: 10,
          dayOfWeek: 'MONDAY',
          campId: 'test-camp-id',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Expected job with derived properties
      const expectedJob = {
        ...mockJob,
        staffOnly: false,
        alwaysRequired: true,
      };

      mockPrismaService.job.create.mockResolvedValue(mockJob);

      const result = await service.create(createJobDto);

      expect(result).toEqual(expectedJob);
      expect(mockPrismaService.job.create).toHaveBeenCalledWith({
        data: {
          name: createJobDto.name,
          description: createJobDto.description,
          location: createJobDto.location,
          maxRegistrations: 10,
          category: {
            connect: { id: createJobDto.categoryId }
          },
          shift: {
            connect: { id: createJobDto.shiftId }
          }
        },
        include: {
          category: true,
          shift: true,
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return all jobs with derived properties', async () => {
      const mockJobs = [
        {
          id: 'test-id-1',
          name: 'Test Job 1',
          description: 'Test Description 1',
          location: 'Test Location 1',
          categoryId: 'test-category-id-1',
          shiftId: 'test-shift-id-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          category: {
            id: 'test-category-id-1',
            name: 'Test Category 1',
            description: 'Test Category Description 1',
            staffOnly: true,
            alwaysRequired: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          shift: {
            id: 'test-shift-id-1',
            name: 'Test Shift 1',
            description: 'Test Shift Description 1',
            startTime: new Date(),
            endTime: new Date(),
            maxRegistrations: 10,
            dayOfWeek: 'MONDAY',
            campId: 'test-camp-id',
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
          shiftId: 'test-shift-id-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          category: {
            id: 'test-category-id-2',
            name: 'Test Category 2',
            description: 'Test Category Description 2',
            staffOnly: false,
            alwaysRequired: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          shift: {
            id: 'test-shift-id-2',
            name: 'Test Shift 2',
            description: 'Test Shift Description 2',
            startTime: new Date(),
            endTime: new Date(),
            maxRegistrations: 10,
            dayOfWeek: 'TUESDAY',
            campId: 'test-camp-id',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      // Expected jobs with derived properties
      const expectedJobs = mockJobs.map(job => ({
        ...job,
        staffOnly: job.category.staffOnly,
        alwaysRequired: job.category.alwaysRequired,
      }));

      mockPrismaService.job.findMany.mockResolvedValue(mockJobs);

      const result = await service.findAll();

      expect(result).toEqual(expectedJobs);
      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        include: {
          category: true,
          shift: true,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a job by id with derived properties', async () => {
      const jobId = 'test-id';
      const mockJob = {
        id: jobId,
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
        shiftId: 'test-shift-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'test-category-id',
          name: 'Test Category',
          description: 'Test Category Description',
          staffOnly: true,
          alwaysRequired: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        shift: {
          id: 'test-shift-id',
          name: 'Test Shift',
          description: 'Test Shift Description',
          startTime: new Date(),
          endTime: new Date(),
          maxRegistrations: 10,
          dayOfWeek: 'MONDAY',
          campId: 'test-camp-id',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Expected job with derived properties
      const expectedJob = {
        ...mockJob,
        staffOnly: true,
        alwaysRequired: false,
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      const result = await service.findOne(jobId);

      expect(result).toEqual(expectedJob);
      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: jobId },
        include: {
          category: true,
          shift: true,
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
    it('should update a job and include derived properties', async () => {
      const jobId = 'test-id';
      const updateJobDto: UpdateJobDto = {
        name: 'Updated Job',
        description: 'Updated Description',
        shiftId: 'updated-shift-id',
      };

      const mockUpdatedJob = {
        id: jobId,
        name: 'Updated Job',
        description: 'Updated Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
        shiftId: 'updated-shift-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'test-category-id',
          name: 'Test Category',
          description: 'Test Category Description',
          staffOnly: false,
          alwaysRequired: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        shift: {
          id: 'updated-shift-id',
          name: 'Updated Shift',
          description: 'Updated Shift Description',
          startTime: new Date(),
          endTime: new Date(),
          maxRegistrations: 15,
          dayOfWeek: 'WEDNESDAY',
          campId: 'test-camp-id',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Expected job with derived properties
      const expectedJob = {
        ...mockUpdatedJob,
        staffOnly: false,
        alwaysRequired: true,
      };

      mockPrismaService.job.update.mockResolvedValue(mockUpdatedJob);

      const result = await service.update(jobId, updateJobDto);

      expect(result).toEqual(expectedJob);
      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: expect.objectContaining({
          name: updateJobDto.name,
          description: updateJobDto.description,
          shift: {
            connect: { id: updateJobDto.shiftId }
          }
        }),
        include: {
          category: true,
          shift: true,
        },
      });
    });

    it('should throw NotFoundException if job to update is not found', async () => {
      const jobId = 'non-existent-id';
      const updateJobDto = { name: 'Updated Job' };

      mockPrismaService.job.update.mockRejectedValue(new Error());

      await expect(service.update(jobId, updateJobDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a job and include derived properties', async () => {
      const jobId = 'test-id';
      const mockJob = {
        id: jobId,
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
        shiftId: 'test-shift-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'test-category-id',
          name: 'Test Category',
          description: 'Test Category Description',
          staffOnly: true,
          alwaysRequired: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        shift: {
          id: 'test-shift-id',
          name: 'Test Shift',
          description: 'Test Shift Description',
          startTime: new Date(),
          endTime: new Date(),
          maxRegistrations: 10,
          dayOfWeek: 'MONDAY',
          campId: 'test-camp-id',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Expected job with derived properties
      const expectedJob = {
        ...mockJob,
        staffOnly: true,
        alwaysRequired: false,
      };

      mockPrismaService.job.delete.mockResolvedValue(mockJob);

      const result = await service.remove(jobId);

      expect(result).toEqual(expectedJob);
      expect(mockPrismaService.job.delete).toHaveBeenCalledWith({
        where: { id: jobId },
        include: {
          category: true,
          shift: true,
        },
      });
    });

    it('should throw NotFoundException if job to remove is not found', async () => {
      const jobId = 'non-existent-id';
      mockPrismaService.job.delete.mockRejectedValue(new Error());

      await expect(service.remove(jobId)).rejects.toThrow(NotFoundException);
    });
  });
}); 