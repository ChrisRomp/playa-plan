import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('JobsController', () => {
  let controller: JobsController;
  let service: JobsService;

  const mockJobsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<JobsController>(JobsController);
    service = module.get<JobsService>(JobsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a job', async () => {
      const createJobDto = {
        name: 'Test Job',
        description: 'Test Description',
        location: 'Test Location',
        categoryId: 'test-category-id',
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

      mockJobsService.create.mockResolvedValue(expectedJob);

      const result = await controller.create(createJobDto);

      expect(result).toEqual(expectedJob);
      expect(mockJobsService.create).toHaveBeenCalledWith(createJobDto);
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

      mockJobsService.findAll.mockResolvedValue(expectedJobs);

      const result = await controller.findAll();

      expect(result).toEqual(expectedJobs);
      expect(mockJobsService.findAll).toHaveBeenCalled();
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

      mockJobsService.findOne.mockResolvedValue(expectedJob);

      const result = await controller.findOne(jobId);

      expect(result).toEqual(expectedJob);
      expect(mockJobsService.findOne).toHaveBeenCalledWith(jobId);
    });
  });

  describe('update', () => {
    it('should update a job', async () => {
      const jobId = 'test-id';
      const updateJobDto = {
        name: 'Updated Job',
        description: 'Updated Description',
        location: 'Updated Location',
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

      mockJobsService.update.mockResolvedValue(expectedJob);

      const result = await controller.update(jobId, updateJobDto);

      expect(result).toEqual(expectedJob);
      expect(mockJobsService.update).toHaveBeenCalledWith(jobId, updateJobDto);
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

      mockJobsService.remove.mockResolvedValue(expectedJob);

      const result = await controller.remove(jobId);

      expect(result).toEqual(expectedJob);
      expect(mockJobsService.remove).toHaveBeenCalledWith(jobId);
    });
  });
}); 