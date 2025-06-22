import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RegistrationsService } from '../registrations/registrations.service';

describe('JobsController', () => {
  let controller: JobsController;

  const mockJobsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  
  const mockRegistrationsService = {
    create: jest.fn(),
    findByUser: jest.fn(),
    findOne: jest.fn(),
    findByJob: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
        {
          provide: RegistrationsService,
          useValue: mockRegistrationsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<JobsController>(JobsController);
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
        shiftId: 'test-shift-id',
      };

      // Expected job response includes derived properties from category
      const expectedJob = {
        id: 'test-id',
        ...createJobDto,
        staffOnly: false,      // Derived from category
        alwaysRequired: false, // Derived from category
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'test-category-id',
          name: 'Test Category',
          description: 'Test Category Description',
          staffOnly: false,
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
          shiftId: 'test-shift-id-1',
          staffOnly: true,       // Derived from category
          alwaysRequired: false, // Derived from category
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
          staffOnly: false,      // Derived from category
          alwaysRequired: true,  // Derived from category
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
            maxRegistrations: 8,
            dayOfWeek: 'TUESDAY',
            campId: 'test-camp-id',
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
        shiftId: 'test-shift-id',
        staffOnly: true,       // Derived from category
        alwaysRequired: false, // Derived from category
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
        shiftId: 'updated-shift-id',
      };

      const expectedJob = {
        id: jobId,
        ...updateJobDto,
        categoryId: 'test-category-id',
        staffOnly: false,      // Derived from category
        alwaysRequired: true,  // Derived from category
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
        shiftId: 'test-shift-id',
        staffOnly: true,       // Derived from category
        alwaysRequired: false, // Derived from category
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

      mockJobsService.remove.mockResolvedValue(expectedJob);

      const result = await controller.remove(jobId);

      expect(result).toEqual(expectedJob);
      expect(mockJobsService.remove).toHaveBeenCalledWith(jobId);
    });
  });
}); 