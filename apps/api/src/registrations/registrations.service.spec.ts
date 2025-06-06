import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
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
    registrationJob: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
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
    campingOptionRegistration: {
      findMany: jest.fn(),
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
        {
          provide: NotificationsService,
          useValue: {
            sendRegistrationConfirmationEmail: jest.fn().mockResolvedValue(true),
            sendRegistrationErrorEmail: jest.fn().mockResolvedValue(true),
          },
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
      year: 2024,
      jobIds: ['job-id-1', 'job-id-2'],
    };

    const mockJobs = [
      {
        id: 'job-id-1',
        maxRegistrations: 10,
        registrations: [],
      },
      {
        id: 'job-id-2',
        maxRegistrations: 5,
        registrations: [],
      },
    ];

    const mockUser = {
      id: 'user-id',
      email: 'test@example.playaplan.app',
    };

    const mockRegistration = {
      id: 'registration-id',
      userId: 'user-id',
      year: 2024,
      status: RegistrationStatus.PENDING,
      jobs: [],
      payments: [],
    };

    it('should create a registration successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.job.findUnique
        .mockResolvedValueOnce(mockJobs[0])
        .mockResolvedValueOnce(mockJobs[1]);
      mockPrismaService.registration.create.mockResolvedValue(mockRegistration);

      const result = await service.create(createDto);
      
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.userId },
      });
      expect(mockPrismaService.registration.findFirst).toHaveBeenCalledWith({
        where: {
          userId: createDto.userId,
          year: createDto.year,
          status: { notIn: [RegistrationStatus.CANCELLED] },
        },
      });
      expect(mockPrismaService.job.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.registration.create).toHaveBeenCalled();
      expect(result).toEqual(mockRegistration);
    });

    it('should allow registration when user has only cancelled registrations', async () => {
      const cancelledRegistration = {
        id: 'cancelled-registration-id',
        userId: 'user-id',
        year: 2024,
        status: RegistrationStatus.CANCELLED,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(null); // No active registrations
      mockPrismaService.job.findUnique
        .mockResolvedValueOnce(mockJobs[0])
        .mockResolvedValueOnce(mockJobs[1]);
      mockPrismaService.registration.create.mockResolvedValue(mockRegistration);

      const result = await service.create(createDto);
      
      expect(mockPrismaService.registration.findFirst).toHaveBeenCalledWith({
        where: {
          userId: createDto.userId,
          year: createDto.year,
          status: { notIn: [RegistrationStatus.CANCELLED] },
        },
      });
      expect(result).toEqual(mockRegistration);
    });

    it('should throw NotFoundException if job does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user already has registration for year', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue({
        id: 'existing-registration',
        userId: 'user-id',
        year: 2024,
      });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should set status to WAITLISTED if any job is at capacity', async () => {
      const fullJob = {
        id: 'job-id-1',
        maxRegistrations: 1,
        registrations: [{ registration: { status: RegistrationStatus.CONFIRMED } }],
      };
      
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.job.findUnique
        .mockResolvedValueOnce(fullJob)
        .mockResolvedValueOnce(mockJobs[1]);
      mockPrismaService.registration.create.mockResolvedValue({
        ...mockRegistration,
        status: RegistrationStatus.WAITLISTED,
      });

      const result = await service.create(createDto);
      
      expect(result.status).toBe(RegistrationStatus.WAITLISTED);
    });
  });

  describe('findAll', () => {
    it('should return an array of registrations', async () => {
      const expectedRegistrations = [
        { id: '1', userId: 'user1', year: 2024, jobs: [], payments: [] },
        { id: '2', userId: 'user2', year: 2024, jobs: [], payments: [] },
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
        { id: '1', userId, year: 2024, jobs: [], payments: [] },
        { id: '2', userId, year: 2023, jobs: [], payments: [] },
      ];
      
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.registration.findMany.mockResolvedValue(expectedRegistrations);

      const result = await service.findByUser(userId);
      
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockPrismaService.registration.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          jobs: {
            include: {
              job: {
                include: {
                  category: true,
                  shift: true,
                },
              },
            },
          },
          payments: true,
        },
        orderBy: {
          year: 'desc',
        },
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
      const expectedRegistrationJobs = [
        { registration: { id: '1', userId: 'user1', year: 2024, user: {}, payments: [] } },
        { registration: { id: '2', userId: 'user2', year: 2024, user: {}, payments: [] } },
      ];
      
      mockPrismaService.job.findUnique.mockResolvedValue({ id: jobId });
      mockPrismaService.registrationJob.findMany.mockResolvedValue(expectedRegistrationJobs);

      const result = await service.findByJob(jobId);
      
      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: jobId },
      });
      expect(mockPrismaService.registrationJob.findMany).toHaveBeenCalledWith({
        where: { jobId },
        include: {
          registration: {
            include: {
              user: true,
              payments: true,
            },
          },
        },
      });
      expect(result).toEqual(expectedRegistrationJobs.map(rj => rj.registration));
    });

    it('should throw NotFoundException if job does not exist', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(service.findByJob(jobId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    const registrationId = 'registration-id';
    
    it('should return a registration by id', async () => {
      const expectedRegistration = {
        id: registrationId,
        userId: 'user-id',
        year: 2024,
        jobs: [],
        payments: [],
      };
      
      mockPrismaService.registration.findUnique.mockResolvedValue(expectedRegistration);

      const result = await service.findOne(registrationId);
      
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: registrationId },
        include: expect.any(Object),
      });
      expect(result).toEqual(expectedRegistration);
    });

    it('should throw NotFoundException if registration does not exist', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(null);

      await expect(service.findOne(registrationId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const registrationId = 'registration-id';
    const updateDto = { status: RegistrationStatus.CONFIRMED };
    
    it('should update a registration successfully', async () => {
      const existingRegistration = {
        id: registrationId,
        userId: 'user-id',
        year: 2024,
        status: RegistrationStatus.PENDING,
        user: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
        jobs: [],
        payments: [],
      };
      const updatedRegistration = {
        ...existingRegistration,
        status: RegistrationStatus.CONFIRMED,
      };
      
      mockPrismaService.registration.findUnique.mockResolvedValue(existingRegistration);
      mockPrismaService.registration.update.mockResolvedValue(updatedRegistration);
      mockPrismaService.campingOptionRegistration.findMany.mockResolvedValue([]);

      const result = await service.update(registrationId, updateDto);
      
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: registrationId },
        include: {
          user: true,
          jobs: {
            include: {
              job: {
                include: {
                  category: true,
                  shift: true,
                },
              },
            },
          },
          payments: true,
        },
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
    
    it('should delete a registration successfully', async () => {
      const existingRegistration = {
        id: registrationId,
        userId: 'user-id',
        year: 2024,
        jobs: [],
        payments: [],
      };
      
      mockPrismaService.registration.findUnique.mockResolvedValue(existingRegistration);
      mockPrismaService.registration.delete.mockResolvedValue(existingRegistration);

      const result = await service.remove(registrationId);
      
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: registrationId },
        include: expect.any(Object),
      });
      expect(mockPrismaService.registration.delete).toHaveBeenCalledWith({
        where: { id: registrationId },
      });
      expect(result).toEqual(existingRegistration);
    });

    it('should throw NotFoundException if registration does not exist', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(null);

      await expect(service.remove(registrationId)).rejects.toThrow(NotFoundException);
    });
  });
});
