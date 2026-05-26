import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import {
  CompleteRegistrationDto,
  CreateRegistrationDto,
  SubmitApplicationDto,
  UpdateRegistrationDto,
} from './dto';
import { RegistrationStatus, UserRole } from '@prisma/client';

describe('RegistrationsController', () => {
  let controller: RegistrationsController;
  // Service is mocked and accessed through the controller

  const mockRegistrationsService = {
    create: jest.fn(),
    submitApplication: jest.fn(),
    completeRegistration: jest.fn(),
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
        year: 2024,
        jobIds: ['job-id-1', 'job-id-2'],
      };
      
      const expectedResult = {
        id: 'registration-id',
        userId: 'user-id',
        year: 2024,
        status: RegistrationStatus.PENDING,
        jobs: [],
        payments: [],
      };
      
      mockRegistrationsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);
      
      expect(mockRegistrationsService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('submitApplication', () => {
    it('should submit an application for the authenticated user', async () => {
      const submitApplicationDto: SubmitApplicationDto = {
        campingOptions: ['camping-option-id'],
        customFields: { 'field-id': 'value' },
      };
      const mockRequest = {
        user: {
          id: 'user-id',
          email: 'user@example.com',
          role: UserRole.PARTICIPANT,
        },
      } as any;
      const expectedResult = {
        registration: {
          id: 'registration-id',
          status: RegistrationStatus.APPLICATION_SUBMITTED,
        },
        campingOptionRegistrations: [],
        message: 'Application submitted successfully',
      };

      mockRegistrationsService.submitApplication.mockResolvedValue(expectedResult);

      const result = await controller.submitApplication(submitApplicationDto, mockRequest);

      expect(mockRegistrationsService.submitApplication).toHaveBeenCalledWith(
        mockRequest.user.id,
        submitApplicationDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('completeRegistration', () => {
    it('should complete a registration for the authenticated user', async () => {
      const completeRegistrationDto: CompleteRegistrationDto = {
        jobs: ['job-id-1'],
        acceptedTerms: true,
        deferPayment: true,
      };
      const mockRequest = {
        user: {
          id: 'user-id',
          email: 'user@example.com',
          role: UserRole.PARTICIPANT,
        },
      } as any;
      const expectedResult = {
        registration: {
          id: 'registration-id',
          status: RegistrationStatus.CONFIRMED,
          paymentDeferred: true,
        },
        message: 'Registration completed successfully',
      };

      mockRegistrationsService.completeRegistration.mockResolvedValue(expectedResult);

      const result = await controller.completeRegistration(completeRegistrationDto, mockRequest);

      expect(mockRegistrationsService.completeRegistration).toHaveBeenCalledWith(
        mockRequest.user.id,
        completeRegistrationDto,
      );
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
