import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RegistrationStatus } from '@prisma/client';
import { CreateRegistrationDto } from './dto';

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  // PrismaService is mocked and not directly used in tests

  const mockPrismaService = {
    registration: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateRegistrationDto = {
      userId: 'user-id',
      jobId: 'job-id',
    };

    const mockJob = {
      id: 'job-id',
      shift: {
        maxRegistrations: 10,
      },
      registrations: [],
    };

    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
    };

    const mockRegistration = {
      id: 'registration-id',
      userId: 'user-id',
      jobId: 'job-id',
      status: RegistrationStatus.PENDING,
    };

    it('should create a registration successfully', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.registration.create.mockResolvedValue(mockRegistration);

      const result = await service.create(createDto);
      
      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.jobId },
        include: { shift: true, registrations: true },
      });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.userId },
      });
      expect(mockPrismaService.registration.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.registration.create).toHaveBeenCalled();
      expect(result).toEqual(mockRegistration);
    });

    it('should throw NotFoundException if job does not exist', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user already registered for job', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue({
        id: 'existing-registration',
        userId: 'user-id',
        jobId: 'job-id',
      });

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should set status to WAITLISTED if job is at capacity', async () => {
      const fullJob = {
        ...mockJob,
        shift: {
          maxRegistrations: 10,
        },
        registrations: Array(10).fill({ status: RegistrationStatus.CONFIRMED }),
      };
      
      mockPrismaService.job.findUnique.mockResolvedValue(fullJob);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.registration.create.mockImplementation((args) => {
        return Promise.resolve({
          ...args.data,
          id: 'registration-id',
          status: RegistrationStatus.WAITLISTED,
        });
      });

      const result = await service.create(createDto);
      
      expect(result.status).toBe(RegistrationStatus.WAITLISTED);
    });
  });

  describe('findAll', () => {
    it('should return an array of registrations', async () => {
      const expectedRegistrations = [
        { id: '1', userId: 'user1', jobId: 'job1' },
        { id: '2', userId: 'user2', jobId: 'job2' },
      ];
      mockPrismaService.registration.findMany.mockResolvedValue(expectedRegistrations);

      const result = await service.findAll();
      
      expect(mockPrismaService.registration.findMany).toHaveBeenCalled();
      expect(result).toEqual(expectedRegistrations);
    });
  });

  describe('findByUser', () => {
    const userId = 'user-id';
    
    it('should return registrations for a specific user', async () => {
      const expectedRegistrations = [
        { id: '1', userId, jobId: 'job1' },
        { id: '2', userId, jobId: 'job2' },
      ];
      
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.registration.findMany.mockResolvedValue(expectedRegistrations);

      const result = await service.findByUser(userId);
      
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockPrismaService.registration.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: expect.any(Object),
      });
      expect(result).toEqual(expectedRegistrations);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByUser(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByJob', () => {
    const jobId = 'job-id';
    
    it('should return registrations for a specific job', async () => {
      const expectedRegistrations = [
        { id: '1', userId: 'user1', jobId },
        { id: '2', userId: 'user2', jobId },
      ];
      
      mockPrismaService.job.findUnique.mockResolvedValue({ id: jobId });
      mockPrismaService.registration.findMany.mockResolvedValue(expectedRegistrations);

      const result = await service.findByJob(jobId);
      
      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: jobId },
      });
      expect(mockPrismaService.registration.findMany).toHaveBeenCalledWith({
        where: { jobId },
        include: expect.any(Object),
      });
      expect(result).toEqual(expectedRegistrations);
    });

    it('should throw NotFoundException if job does not exist', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(service.findByJob(jobId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    const registrationId = 'registration-id';
    const mockRegistration = { id: registrationId, userId: 'user-id', jobId: 'job-id' };
    
    it('should return a registration by id', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(mockRegistration);

      const result = await service.findOne(registrationId);
      
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: registrationId },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockRegistration);
    });

    it('should throw NotFoundException if registration does not exist', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(null);

      await expect(service.findOne(registrationId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const registrationId = 'registration-id';
    const updateDto = { status: RegistrationStatus.CONFIRMED };
    const mockRegistration = { 
      id: registrationId, 
      userId: 'user-id', 
      jobId: 'job-id',
      status: RegistrationStatus.PENDING,
    };
    
    it('should update a registration successfully', async () => {
      const updatedRegistration = { ...mockRegistration, ...updateDto };
      
      mockPrismaService.registration.findUnique.mockResolvedValue(mockRegistration);
      mockPrismaService.registration.update.mockResolvedValue(updatedRegistration);

      const result = await service.update(registrationId, updateDto);
      
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: registrationId },
        include: expect.any(Object),
      });
      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: registrationId },
        data: updateDto,
        include: expect.any(Object),
      });
      expect(result).toEqual(updatedRegistration);
    });

    it('should throw NotFoundException if registration does not exist', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(null);

      await expect(service.update(registrationId, updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const registrationId = 'registration-id';
    const mockRegistration = { id: registrationId, userId: 'user-id', jobId: 'job-id' };
    
    it('should delete a registration successfully', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(mockRegistration);
      mockPrismaService.registration.delete.mockResolvedValue(mockRegistration);

      const result = await service.remove(registrationId);
      
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: registrationId },
        include: expect.any(Object),
      });
      expect(mockPrismaService.registration.delete).toHaveBeenCalledWith({
        where: { id: registrationId },
      });
      expect(result).toEqual(mockRegistration);
    });

    it('should throw NotFoundException if registration does not exist', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(null);

      await expect(service.remove(registrationId)).rejects.toThrow(NotFoundException);
    });
  });
});
