import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto, UpdateRegistrationDto } from './dto';
import { RegistrationStatus } from '@prisma/client';

describe('RegistrationsController', () => {
  let controller: RegistrationsController;
  // Service is mocked and accessed through the controller

  const mockRegistrationsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByUser: jest.fn(),
    findByJob: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegistrationsController],
      providers: [
        {
          provide: RegistrationsService,
          useValue: mockRegistrationsService,
        },
      ],
    }).compile();

    controller = module.get<RegistrationsController>(RegistrationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a registration', async () => {
      const createDto: CreateRegistrationDto = {
        userId: 'user-id',
        jobId: 'job-id',
      };
      
      const expectedResult = {
        id: 'registration-id',
        userId: 'user-id',
        jobId: 'job-id',
        status: RegistrationStatus.PENDING,
      };
      
      mockRegistrationsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);
      
      expect(mockRegistrationsService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should return all registrations when no query params', async () => {
      const expectedRegistrations = [
        { id: '1', userId: 'user1', jobId: 'job1' },
        { id: '2', userId: 'user2', jobId: 'job2' },
      ];
      
      mockRegistrationsService.findAll.mockResolvedValue(expectedRegistrations);

      const result = await controller.findAll();
      
      expect(mockRegistrationsService.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedRegistrations);
    });

    it('should return registrations for a specific user when userId provided', async () => {
      const userId = 'user-id';
      const expectedRegistrations = [
        { id: '1', userId, jobId: 'job1' },
        { id: '2', userId, jobId: 'job2' },
      ];
      
      mockRegistrationsService.findByUser.mockResolvedValue(expectedRegistrations);

      const result = await controller.findAll(userId);
      
      expect(mockRegistrationsService.findByUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedRegistrations);
    });

    it('should return registrations for a specific job when jobId provided', async () => {
      const jobId = 'job-id';
      const expectedRegistrations = [
        { id: '1', userId: 'user1', jobId },
        { id: '2', userId: 'user2', jobId },
      ];
      
      mockRegistrationsService.findByJob.mockResolvedValue(expectedRegistrations);

      const result = await controller.findAll(undefined, jobId);
      
      expect(mockRegistrationsService.findByJob).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(expectedRegistrations);
    });
  });

  describe('findOne', () => {
    it('should return a registration by id', async () => {
      const registrationId = 'registration-id';
      const expectedRegistration = {
        id: registrationId,
        userId: 'user-id',
        jobId: 'job-id',
      };
      
      mockRegistrationsService.findOne.mockResolvedValue(expectedRegistration);

      const result = await controller.findOne(registrationId);
      
      expect(mockRegistrationsService.findOne).toHaveBeenCalledWith(registrationId);
      expect(result).toEqual(expectedRegistration);
    });
  });

  describe('update', () => {
    it('should update a registration', async () => {
      const registrationId = 'registration-id';
      const updateDto: UpdateRegistrationDto = {
        status: RegistrationStatus.CONFIRMED,
      };
      
      const expectedResult = {
        id: registrationId,
        userId: 'user-id',
        jobId: 'job-id',
        status: RegistrationStatus.CONFIRMED,
      };
      
      mockRegistrationsService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(registrationId, updateDto);
      
      expect(mockRegistrationsService.update).toHaveBeenCalledWith(registrationId, updateDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should delete a registration', async () => {
      const registrationId = 'registration-id';
      const expectedResult = {
        id: registrationId,
        userId: 'user-id',
        jobId: 'job-id',
      };
      
      mockRegistrationsService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(registrationId);
      
      expect(mockRegistrationsService.remove).toHaveBeenCalledWith(registrationId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('adminTest', () => {
    it('should return a test message', async () => {
      const result = await controller.adminTest();
      
      expect(result).toEqual({ message: 'Admin access to registrations module confirmed' });
    });
  });
});
