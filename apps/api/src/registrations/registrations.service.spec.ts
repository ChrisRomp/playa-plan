import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import { RegistrationPolicyService } from './services/registration-policy.service';
import { CoreConfigService } from '../core-config/services/core-config.service';
import { NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { NotificationType, RegistrationStatus, UserRole } from '@prisma/client';
import { CompleteRegistrationDto, CreateRegistrationDto, SubmitApplicationDto } from './dto';

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  let mockCoreConfigService: { findCurrent: jest.Mock };
  // PrismaService is mocked and not directly used in tests

  type MockPrismaService = {
    registration: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    registrationJob: { create: jest.Mock; createMany: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; delete: jest.Mock };
    job: { findUnique: jest.Mock; findMany: jest.Mock };
    user: { findUnique: jest.Mock };
    payment: { findUnique: jest.Mock };
    campingOption: { findUnique: jest.Mock };
    campingOptionRegistration: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    campingOptionFieldValue: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const mockPrismaService: MockPrismaService = {
    registration: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    registrationJob: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
    },
    campingOption: {
      findUnique: jest.fn(),
    },
    campingOptionRegistration: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    campingOptionFieldValue: {
      create: jest.fn(),
    },
    // Default: run the callback with the mockPrismaService itself as the
    // `tx` client. Per-test overrides can replace this to simulate
    // rollback by throwing instead of running the callback.
    $transaction: jest.fn(async (callback: (tx: MockPrismaService) => unknown) =>
      callback(mockPrismaService),
    ),
  };

  const mockPolicyService = {
    // Default to a no-op (permissive) policy so existing tests of create()
    // (which does not exercise the policy gate) continue to pass without
    // wiring per-test stubs. Tests of createCampRegistration explicitly
    // set this mock to reject when they want to assert policy failures.
    assertCanCreateCampRegistration: jest.fn().mockResolvedValue(undefined),
    assertCanSubmitApplication: jest.fn().mockResolvedValue(undefined),
    shouldAutoApprove: jest.fn().mockReturnValue(false),
  };

  const mockNotificationsService = {
    sendNotification: jest.fn().mockResolvedValue(true),
    sendRegistrationConfirmationEmail: jest.fn().mockResolvedValue(true),
    sendRegistrationErrorEmail: jest.fn().mockResolvedValue(true),
  };

  const expectedParticipantPaymentSelect = {
    id: true,
    amount: true,
    currency: true,
    status: true,
    provider: true,
    providerRefId: true,
    createdAt: true,
    updatedAt: true,
    userId: true,
    registrationId: true,
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
          useValue: mockNotificationsService,
        },
        {
          provide: RegistrationPolicyService,
          useValue: mockPolicyService,
        },
        {
          provide: CoreConfigService,
          useFactory: () => {
            mockCoreConfigService = {
              findCurrent: jest.fn().mockResolvedValue({ registrationYear: new Date().getFullYear() }),
            };
            return mockCoreConfigService;
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
      payments: [{ id: 'payment-id', amount: 100 }],
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
      expect(mockPrismaService.registration.create).toHaveBeenCalledWith({
        data: {
          status: RegistrationStatus.PENDING,
          year: createDto.year,
          user: { connect: { id: createDto.userId } },
          jobs: {
            create: createDto.jobIds.map((jobId) => ({
              job: { connect: { id: jobId } },
            })),
          },
        },
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
          payments: {
            select: expectedParticipantPaymentSelect,
          },
        },
      });
      expect(result).toEqual(mockRegistration);
      expect(result).not.toHaveProperty('payments.0.externalMethod');
      expect(result).not.toHaveProperty('payments.0.externalReference');
      expect(result).not.toHaveProperty('payments.0.idempotencyKey');
      expect(result).not.toHaveProperty('payments.0.refunds');
    });

    it('should allow registration when user has only cancelled registrations', async () => {
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
        registrations: [{ registration: { status: RegistrationStatus.CONFIRMED, year: 2024 } }],
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
      expect(mockPrismaService.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RegistrationStatus.WAITLISTED,
          }),
        }),
      );
    });

    it('should not count prior-year registrations toward capacity', async () => {
      const jobWithPriorYearReg = {
        id: 'job-id-1',
        maxRegistrations: 1,
        registrations: [{ registration: { status: RegistrationStatus.CONFIRMED, year: 2023 } }],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.job.findUnique
        .mockResolvedValueOnce(jobWithPriorYearReg)
        .mockResolvedValueOnce(mockJobs[1]);
      mockPrismaService.registration.create.mockResolvedValue(mockRegistration);

      const result = await service.create(createDto);

      expect(result.status).toBe(RegistrationStatus.PENDING);
      expect(mockPrismaService.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RegistrationStatus.PENDING,
          }),
        }),
      );
    });

    it('should throw ForbiddenException when participant registers for staffOnly job', async () => {
      const mockParticipant = {
        id: 'user-id',
        email: 'test@example.playaplan.app',
        role: UserRole.PARTICIPANT,
      };
      const staffOnlyJob = {
        id: 'job-id-1',
        staffOnly: true,
        maxRegistrations: 10,
        registrations: [],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockParticipant);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.job.findUnique.mockResolvedValue(staffOnlyJob);
      mockPrismaService.job.findMany.mockResolvedValue([staffOnlyJob]);

      const inputDto: CreateRegistrationDto = {
        userId: 'user-id',
        year: 2024,
        jobIds: ['job-id-1'],
      };
      await expect(service.create(inputDto)).rejects.toThrow(ForbiddenException);
    });

    it('should allow staff to register for staffOnly job', async () => {
      const mockStaff = {
        id: 'user-id',
        email: 'staff@example.playaplan.app',
        role: UserRole.STAFF,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.job.findUnique.mockResolvedValue(mockJobs[0]);
      mockPrismaService.job.findMany.mockResolvedValue([]);
      mockPrismaService.registration.create.mockResolvedValue(mockRegistration);

      const result = await service.create(createDto);
      expect(result).toEqual(mockRegistration);
    });

    it('should allow admin to register for staffOnly job', async () => {
      const mockAdmin = {
        id: 'user-id',
        email: 'admin@example.playaplan.app',
        role: UserRole.ADMIN,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdmin);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.job.findUnique.mockResolvedValue(mockJobs[0]);
      mockPrismaService.job.findMany.mockResolvedValue([]);
      mockPrismaService.registration.create.mockResolvedValue(mockRegistration);

      const result = await service.create(createDto);
      expect(result).toEqual(mockRegistration);
    });

    it('should throw ForbiddenException when participant registers with mix of normal and staffOnly jobs', async () => {
      const mockParticipant = {
        id: 'user-id',
        email: 'test@example.playaplan.app',
        role: UserRole.PARTICIPANT,
      };
      const staffOnlyJob = {
        id: 'job-id-2',
        staffOnly: true,
        maxRegistrations: 10,
        registrations: [],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockParticipant);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.job.findMany.mockResolvedValue([staffOnlyJob]);

      await expect(service.create(createDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when participant registers for job with staffOnly category', async () => {
      const mockParticipant = {
        id: 'user-id',
        email: 'test@example.playaplan.app',
        role: UserRole.PARTICIPANT,
      };
      const jobWithStaffOnlyCategory = {
        id: 'job-id-1',
        staffOnly: false,
        maxRegistrations: 10,
        registrations: [],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockParticipant);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.job.findMany.mockResolvedValue([jobWithStaffOnlyCategory]);

      const inputDto: CreateRegistrationDto = {
        userId: 'user-id',
        year: 2024,
        jobIds: ['job-id-1'],
      };
      await expect(service.create(inputDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addJobToRegistration', () => {
    const mockRegistrationWithJobs = {
      id: 'registration-id',
      userId: 'user-id',
      year: 2024,
      status: RegistrationStatus.PENDING,
      jobs: [],
      user: { id: 'user-id', role: UserRole.PARTICIPANT },
    };

    const mockJobWithRegistrations = {
      id: 'job-id-1',
      staffOnly: false,
      maxRegistrations: 10,
      registrations: [],
    };

    it('should throw BadRequestException when adding job to cancelled registration', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue({
        ...mockRegistrationWithJobs,
        status: RegistrationStatus.CANCELLED,
      });

      await expect(
        service.addJobToRegistration('registration-id', { jobId: 'job-id-1' })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.job.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.registrationJob.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when adding staffOnly job for participant', async () => {
      const staffOnlyJob = {
        id: 'staff-job-id',
        staffOnly: true,
        maxRegistrations: 10,
        registrations: [],
      };
      mockPrismaService.registration.findUnique.mockResolvedValue(mockRegistrationWithJobs);
      mockPrismaService.job.findUnique.mockResolvedValue(staffOnlyJob);
      mockPrismaService.job.findMany.mockResolvedValue([staffOnlyJob]);

      await expect(
        service.addJobToRegistration('registration-id', { jobId: 'staff-job-id' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when registration owner is not found', async () => {
      const registrationWithNoUser = {
        ...mockRegistrationWithJobs,
        user: null,
      };
      const staffOnlyJob = {
        id: 'staff-job-id',
        staffOnly: true,
        maxRegistrations: 10,
        registrations: [],
      };
      mockPrismaService.registration.findUnique.mockResolvedValue(registrationWithNoUser);
      mockPrismaService.job.findUnique.mockResolvedValue(staffOnlyJob);

      await expect(
        service.addJobToRegistration('registration-id', { jobId: 'staff-job-id' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow adding staffOnly job for staff user', async () => {
      const mockStaff = {
        id: 'user-id',
        role: UserRole.STAFF,
      };
      const staffRegistration = {
        ...mockRegistrationWithJobs,
        user: mockStaff,
      };
      mockPrismaService.registration.findUnique
        .mockResolvedValueOnce(staffRegistration)
        .mockResolvedValueOnce({
          ...staffRegistration,
          jobs: [{ job: mockJobWithRegistrations }],
          payments: [],
        });
      mockPrismaService.job.findUnique.mockResolvedValue(mockJobWithRegistrations);
      mockPrismaService.job.findMany.mockResolvedValue([]);
      mockPrismaService.registrationJob.create.mockResolvedValue({});

      const result = await service.addJobToRegistration('registration-id', { jobId: 'job-id-1' });
      expect(result).toBeDefined();
    });
  });

  describe('removeJobFromRegistration', () => {
    it('should throw BadRequestException when removing job from cancelled registration', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue({
        id: 'registration-id',
        status: RegistrationStatus.CANCELLED,
      });

      await expect(
        service.removeJobFromRegistration('registration-id', 'job-id-1')
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.registrationJob.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.registrationJob.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of registrations', async () => {
      const expectedRegistrations = [
        {
          id: '1',
          userId: 'user1',
          year: 2024,
          jobs: [],
          payments: [{ id: 'payment-1', amount: 100 }],
        },
        { id: '2', userId: 'user2', year: 2024, jobs: [], payments: [] },
      ];
      mockPrismaService.registration.findMany.mockResolvedValue(expectedRegistrations);

      const result = await service.findAll();
      
      expect(mockPrismaService.registration.findMany).toHaveBeenCalledWith({
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
          payments: {
            select: expectedParticipantPaymentSelect,
          },
        },
      });
      expect(result).toEqual(expectedRegistrations);
      expect(result[0]).not.toHaveProperty('payments.0.externalMethod');
      expect(result[0]).not.toHaveProperty('payments.0.externalReference');
      expect(result[0]).not.toHaveProperty('payments.0.idempotencyKey');
      expect(result[0]).not.toHaveProperty('payments.0.refunds');
    });
  });

  describe('findByUser', () => {
    const userId = 'user-id';
    
    it('should return registrations for a specific user', async () => {
      const expectedRegistrations = [
        {
          id: '1',
          userId,
          year: 2024,
          jobs: [],
          payments: [{ id: 'payment-1', amount: 100 }],
        },
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
          payments: {
            select: expectedParticipantPaymentSelect,
          },
        },
        orderBy: {
          year: 'desc',
        },
      });
      expect(result).toEqual(expectedRegistrations);
      expect(result[0]).not.toHaveProperty('payments.0.externalMethod');
      expect(result[0]).not.toHaveProperty('payments.0.externalReference');
      expect(result[0]).not.toHaveProperty('payments.0.idempotencyKey');
      expect(result[0]).not.toHaveProperty('payments.0.refunds');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByUser(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUserAndYear', () => {
    it('should select only pre-foundation payment fields', async () => {
      const userId = 'user-id';
      const year = 2026;
      const expectedRegistration = {
        id: 'registration-id',
        userId,
        year,
        jobs: [],
        payments: [{ id: 'payment-id', amount: 100 }],
      };
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.registration.findFirst.mockResolvedValue(
        expectedRegistration,
      );

      const result = await service.findByUserAndYear(userId, year);

      expect(mockPrismaService.registration.findFirst).toHaveBeenCalledWith({
        where: { userId, year },
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
          payments: {
            select: expectedParticipantPaymentSelect,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).not.toHaveProperty('payments.0.externalMethod');
      expect(result).not.toHaveProperty('payments.0.externalReference');
      expect(result).not.toHaveProperty('payments.0.idempotencyKey');
      expect(result).not.toHaveProperty('payments.0.refunds');
    });
  });

  describe('findByJob', () => {
    const jobId = 'job-id';
    
    it('should return registrations for a specific job', async () => {
      const expectedRegistrationJobs = [
        {
          registration: {
            id: '1',
            userId: 'user1',
            year: 2024,
            user: {},
            payments: [{ id: 'payment-1', amount: 100 }],
          },
        },
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
              payments: {
                select: expectedParticipantPaymentSelect,
              },
            },
          },
        },
      });
      expect(result).toEqual(expectedRegistrationJobs.map(rj => rj.registration));
      expect(result[0]).not.toHaveProperty('payments.0.externalMethod');
      expect(result[0]).not.toHaveProperty('payments.0.externalReference');
      expect(result[0]).not.toHaveProperty('payments.0.idempotencyKey');
      expect(result[0]).not.toHaveProperty('payments.0.refunds');
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
        payments: [{ id: 'payment-id', amount: 100 }],
      };
      
      mockPrismaService.registration.findUnique.mockResolvedValue(expectedRegistration);

      const result = await service.findOne(registrationId);
      
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
          payments: {
            select: expectedParticipantPaymentSelect,
          },
        },
      });
      expect(result).toEqual(expectedRegistration);
      expect(result).not.toHaveProperty('payments.0.externalMethod');
      expect(result).not.toHaveProperty('payments.0.externalReference');
      expect(result).not.toHaveProperty('payments.0.idempotencyKey');
      expect(result).not.toHaveProperty('payments.0.refunds');
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
        payments: [{ id: 'payment-id', amount: 100 }],
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
          payments: {
            select: expectedParticipantPaymentSelect,
          },
        },
      });
      expect(result).toEqual(updatedRegistration);
      expect(result).not.toHaveProperty('payments.0.externalMethod');
      expect(result).not.toHaveProperty('payments.0.externalReference');
      expect(result).not.toHaveProperty('payments.0.idempotencyKey');
      expect(result).not.toHaveProperty('payments.0.refunds');
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

  describe('submitApplication', () => {
    const userId = 'user-id-application';
    const applicationYear = 2026;
    const baseUser = {
      id: userId,
      email: 'test@example.playaplan.app',
      firstName: 'Test',
      lastName: 'User',
      playaName: 'Dusty',
      role: UserRole.PARTICIPANT,
      allowRegistration: true,
      allowEarlyRegistration: false,
      autoApproveRegistration: false,
    };
    const baseDto: SubmitApplicationDto = {
      campingOptions: ['opt-1'],
      customFields: {
        'field-1': 'Tent setup',
      },
    };
    const baseCampingOption = {
      id: 'opt-1',
      name: 'Tent Camping',
      description: null,
      enabled: true,
      workShiftsRequired: 0,
      participantDues: 100,
      staffDues: 100,
      maxSignups: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      fields: [
        {
          id: 'field-1',
          displayName: 'Setup Notes',
          description: null,
          dataType: 'TEXT',
          required: false,
          maxLength: null,
          minValue: null,
          maxValue: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          campingOptionId: 'opt-1',
        },
      ],
    };

    beforeEach(() => {
      mockCoreConfigService.findCurrent.mockResolvedValue({
        registrationYear: applicationYear,
        applicationApprovalRequired: true,
      });
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      mockPolicyService.assertCanSubmitApplication.mockResolvedValue(undefined);
      mockPolicyService.shouldAutoApprove.mockReturnValue(false);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.campingOption.findUnique.mockResolvedValue(baseCampingOption);
      mockPrismaService.campingOptionRegistration.findFirst.mockResolvedValue(null);
      mockPrismaService.registration.create.mockImplementation(async ({ data }: { data: { status: RegistrationStatus; paymentDeferred: boolean; year: number; user: { connect: { id: string } } } }) => ({
        id: 'application-registration-id',
        status: data.status,
        paymentDeferred: data.paymentDeferred,
        year: data.year,
        userId: data.user.connect.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [],
        payments: [],
        user: baseUser,
      }));
      mockPrismaService.campingOptionRegistration.create.mockResolvedValue({
        id: 'camping-registration-id',
        userId,
        campingOptionId: 'opt-1',
        registrationId: 'application-registration-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        campingOption: baseCampingOption,
      });
      mockPrismaService.campingOptionFieldValue.create.mockResolvedValue({
        id: 'field-value-id',
      });
      mockNotificationsService.sendNotification.mockResolvedValue(true);
    });

    it('should create an application with APPLICATION_SUBMITTED status and send the received notification', async () => {
      const result = await service.submitApplication(userId, baseDto);

      expect(mockPolicyService.assertCanSubmitApplication).toHaveBeenCalledWith(baseUser);
      expect(mockPolicyService.shouldAutoApprove).toHaveBeenCalledWith(baseUser);
      expect(mockPrismaService.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RegistrationStatus.APPLICATION_SUBMITTED,
            paymentDeferred: false,
            year: applicationYear,
            user: { connect: { id: userId } },
          }),
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
            payments: {
              select: expectedParticipantPaymentSelect,
            },
          },
        }),
      );
      expect(mockPrismaService.campingOptionFieldValue.create).toHaveBeenCalledWith({
        data: {
          fieldId: 'field-1',
          registrationId: 'camping-registration-id',
          value: 'Tent setup',
        },
      });
      expect(mockNotificationsService.sendNotification).toHaveBeenCalledWith(
        baseUser.email,
        NotificationType.APPLICATION_RECEIVED,
        expect.objectContaining({
          userId,
          registrationId: 'application-registration-id',
          applicationDetails: {
            year: applicationYear,
            campingOptions: [{ name: 'Tent Camping' }],
          },
        }),
      );
      expect(result.message).toBe('Application submitted successfully');
      expect(result.registration.status).toBe(RegistrationStatus.APPLICATION_SUBMITTED);
      expect(result).not.toHaveProperty(
        'registration.payments.0.externalMethod',
      );
      expect(result).not.toHaveProperty(
        'registration.payments.0.externalReference',
      );
      expect(result).not.toHaveProperty(
        'registration.payments.0.idempotencyKey',
      );
      expect(result).not.toHaveProperty('registration.payments.0.refunds');
    });

    it('should auto-approve eligible users and send the approved notification', async () => {
      mockPolicyService.shouldAutoApprove.mockReturnValue(true);

      const result = await service.submitApplication(userId, baseDto);

      expect(mockNotificationsService.sendNotification).toHaveBeenCalledWith(
        baseUser.email,
        NotificationType.APPLICATION_APPROVED,
        expect.objectContaining({
          userId,
          registrationId: 'application-registration-id',
        }),
      );
      expect(result.message).toBe(
        'Application approved automatically. Please complete your registration.',
      );
      expect(result.registration.status).toBe(RegistrationStatus.APPLICATION_APPROVED);
    });

    it('should throw when application mode is disabled', async () => {
      mockCoreConfigService.findCurrent.mockResolvedValue({
        registrationYear: applicationYear,
        applicationApprovalRequired: false,
      });

      await expect(service.submitApplication(userId, baseDto)).rejects.toThrow(
        new BadRequestException('Application mode is not enabled'),
      );

      expect(mockPolicyService.assertCanSubmitApplication).not.toHaveBeenCalled();
    });

    it('should reject duplicate camping options before any writes', async () => {
      const duplicateCampingOptionsDto: SubmitApplicationDto = {
        campingOptions: ['opt-1', 'opt-1'],
      };

      await expect(
        service.submitApplication(userId, duplicateCampingOptionsDto),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.registration.create).not.toHaveBeenCalled();
    });
  });

  describe('completeRegistration', () => {
    const userId = 'user-id-complete';
    const registrationYear = 2026;
    const completeDto: CompleteRegistrationDto = {
      jobs: ['job-1'],
      acceptedTerms: true,
      deferPayment: false,
    };
    const baseUser = {
      id: userId,
      email: 'complete@example.playaplan.app',
      firstName: 'Complete',
      lastName: 'User',
      playaName: 'Dusty',
      role: UserRole.PARTICIPANT,
      allowNoJob: false,
      allowDeferredDuesPayment: true,
    };
    const approvedRegistration = {
      id: 'approved-registration-id',
      userId,
      year: registrationYear,
      status: RegistrationStatus.APPLICATION_APPROVED,
      campingOptionRegistrations: [
        {
          id: 'camp-reg-1',
          userId,
          campingOptionId: 'camp-option-1',
          registrationId: 'approved-registration-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          campingOption: {
            id: 'camp-option-1',
            name: 'Tent Camping',
            description: null,
            enabled: true,
            workShiftsRequired: 0,
            participantDues: 100,
            staffDues: 100,
            maxSignups: 50,
            createdAt: new Date(),
            updatedAt: new Date(),
            fields: [],
          },
        },
      ],
    };
    const updatedRegistration = {
      id: 'approved-registration-id',
      userId,
      year: registrationYear,
      status: RegistrationStatus.PENDING,
      paymentDeferred: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: baseUser,
      jobs: [],
      campingOptionRegistrations: approvedRegistration.campingOptionRegistrations,
      payments: [{ id: 'payment-id', amount: 100 }],
    };

    beforeEach(() => {
      mockCoreConfigService.findCurrent.mockResolvedValue({
        registrationYear,
        applicationApprovalRequired: true,
        allowDeferredDuesPayment: true,
      });
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(approvedRegistration);
      mockPrismaService.registration.findUnique.mockResolvedValue(updatedRegistration);
      mockPrismaService.registration.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.job.findMany.mockResolvedValue([]);
      mockPrismaService.job.findUnique.mockImplementation(({ where }: { where: { id: string } }) => ({
        id: where.id,
        maxRegistrations: 10,
        registrations: [],
      }));
      mockPrismaService.registrationJob.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.registration.update.mockResolvedValue(updatedRegistration);
      mockNotificationsService.sendRegistrationConfirmationEmail.mockResolvedValue(true);
    });

    it('should complete an approved application as PENDING when payment is not deferred', async () => {
      const result = await service.completeRegistration(userId, completeDto);

      expect(mockPrismaService.registration.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          year: registrationYear,
          status: { in: [RegistrationStatus.APPLICATION_APPROVED] },
        },
        include: {
          campingOptionRegistrations: {
            include: {
              campingOption: {
                include: {
                  fields: true,
                },
              },
            },
          },
        },
      });
      expect(mockPrismaService.registration.updateMany).toHaveBeenCalledWith({
        where: {
          id: approvedRegistration.id,
          status: { in: [RegistrationStatus.APPLICATION_APPROVED] },
        },
        data: {
          status: RegistrationStatus.PENDING,
          paymentDeferred: false,
        },
      });
      expect(mockPrismaService.registrationJob.createMany).toHaveBeenCalledWith({
        data: [{ registrationId: approvedRegistration.id, jobId: 'job-1' }],
        skipDuplicates: true,
      });
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: approvedRegistration.id },
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
          campingOptionRegistrations: {
            include: {
              campingOption: {
                include: {
                  fields: true,
                },
              },
            },
          },
          payments: {
            select: expectedParticipantPaymentSelect,
          },
        },
      });
      expect(result).toEqual({
        registration: updatedRegistration,
        message: 'Registration completed successfully',
      });
      expect(result).not.toHaveProperty(
        'registration.payments.0.externalMethod',
      );
      expect(result).not.toHaveProperty(
        'registration.payments.0.externalReference',
      );
      expect(result).not.toHaveProperty(
        'registration.payments.0.idempotencyKey',
      );
      expect(result).not.toHaveProperty('registration.payments.0.refunds');
    });

    it('should bypass the approval gate for submitted applications when approval mode is disabled', async () => {
      mockCoreConfigService.findCurrent.mockResolvedValue({
        registrationYear,
        applicationApprovalRequired: false,
        allowDeferredDuesPayment: true,
      });

      await service.completeRegistration(userId, completeDto);

      expect(mockPrismaService.registration.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [
                RegistrationStatus.APPLICATION_APPROVED,
                RegistrationStatus.APPLICATION_SUBMITTED,
              ],
            },
          }),
        }),
      );
    });

    it('should confirm deferred registrations and send the confirmation email', async () => {
      const deferredDto: CompleteRegistrationDto = {
        ...completeDto,
        deferPayment: true,
      };
      mockPrismaService.registration.findUnique.mockResolvedValue({
        ...updatedRegistration,
        status: RegistrationStatus.CONFIRMED,
        paymentDeferred: true,
      });

      const result = await service.completeRegistration(userId, deferredDto);

      expect(result.registration.status).toBe(RegistrationStatus.CONFIRMED);
      expect(result.registration.paymentDeferred).toBe(true);
      expect(mockNotificationsService.sendRegistrationConfirmationEmail).toHaveBeenCalledWith(
        baseUser.email,
        expect.objectContaining({
          id: updatedRegistration.id,
          status: RegistrationStatus.CONFIRMED,
          paymentDeferred: true,
        }),
        userId,
        'Complete User',
        baseUser.playaName,
      );
    });

    it('should reject completion without an eligible approved application', async () => {
      mockPrismaService.registration.findFirst.mockResolvedValue(null);

      await expect(service.completeRegistration(userId, completeDto)).rejects.toThrow(
        new NotFoundException('No approved application found for completion'),
      );
    });

    it('should reject completion with no jobs when the user is not allowNoJob', async () => {
      const noJobsDto: CompleteRegistrationDto = {
        jobs: [],
        acceptedTerms: true,
      };

      await expect(service.completeRegistration(userId, noJobsDto)).rejects.toThrow(
        new BadRequestException('You must select at least one work shift to register.'),
      );

      expect(mockPrismaService.registration.updateMany).not.toHaveBeenCalled();
    });

    it('should reject concurrent completion when registration status has already changed', async () => {
      mockPrismaService.registration.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.completeRegistration(userId, completeDto)).rejects.toThrow(
        ConflictException,
      );

      expect(mockPrismaService.registrationJob.createMany).not.toHaveBeenCalled();
      expect(mockPrismaService.registration.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('createCampRegistration', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createCampRegistration('missing-user', {
          acceptedTerms: true,
          jobs: [],
          campingOptions: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    const userId = 'user-id-camp';
    const baseUser = {
      id: userId,
      email: 'test@example.playaplan.app',
      firstName: 'Test',
      lastName: 'User',
      playaName: null as string | null,
      role: UserRole.PARTICIPANT,
      allowRegistration: true,
      allowEarlyRegistration: false,
      allowNoJob: false,
      allowDeferredDuesPayment: false,
    };

    const baseDto = {
      campingOptions: [],
      jobs: ['job-1'],
      acceptedTerms: true,
    } as unknown as Parameters<RegistrationsService['createCampRegistration']>[1];

    const buildCreatedRegistration = (overrides: Partial<{
      status: RegistrationStatus;
      paymentDeferred: boolean;
      id: string;
    }> = {}) => ({
      id: overrides.id ?? 'reg-1',
      status: overrides.status ?? RegistrationStatus.PENDING,
      paymentDeferred: overrides.paymentDeferred ?? false,
      year: new Date().getFullYear(),
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      jobs: [],
      payments: [{ id: 'payment-id', amount: 100 }],
      user: baseUser,
    });

    beforeEach(() => {
      mockPolicyService.assertCanCreateCampRegistration.mockResolvedValue(undefined);
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.job.findUnique.mockImplementation(({ where }: { where: { id: string } }) => ({
        id: where.id,
        maxRegistrations: 10,
        staffOnly: false,
        registrations: [],
      }));
    });

    it('does not call the policy gate from inside the broad try/catch, so policy 4xx rejections do not trigger the error email', async () => {
      const policyError = new ForbiddenException('Registration is not currently open.');
      mockPolicyService.assertCanCreateCampRegistration.mockRejectedValue(policyError);
      // Wire registration.create to throw a distinct error so we can prove
      // we never reached the broad try/catch (which would log + email).
      mockPrismaService.registration.create.mockRejectedValue(new Error('should not be reached'));

      await expect(
        service.createCampRegistration(userId, baseDto),
      ).rejects.toBe(policyError);

      // The notifications mock is per-suite; assert sendRegistrationErrorEmail
      // was NOT called by checking that the user.findUnique to fetch the
      // error-email recipient ran only the initial "load user" pass.
      // (The current implementation no longer makes a second findUnique
      // for the error email, so a single call is the expected baseline.)
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('always creates a Registration even when jobs is empty (relies on policy gate to enforce allowNoJob)', async () => {
      const dtoNoJobs = { ...baseDto, jobs: [] };
      const created = buildCreatedRegistration({ status: RegistrationStatus.PENDING });
      mockPrismaService.registration.create.mockResolvedValue(created);

      const result = await service.createCampRegistration(userId, dtoNoJobs);

      expect(mockPrismaService.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
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
            payments: {
              select: expectedParticipantPaymentSelect,
            },
          },
        }),
      );
      expect(result.jobRegistration).toEqual(created);
      expect(result).not.toHaveProperty(
        'jobRegistration.payments.0.externalMethod',
      );
      expect(result).not.toHaveProperty(
        'jobRegistration.payments.0.externalReference',
      );
      expect(result).not.toHaveProperty(
        'jobRegistration.payments.0.idempotencyKey',
      );
      expect(result).not.toHaveProperty('jobRegistration.payments.0.refunds');
    });

    it('creates deferred registration as CONFIRMED + paymentDeferred=true when no chosen job is over capacity', async () => {
      const dtoDeferred = { ...baseDto, deferPayment: true };
      const created = buildCreatedRegistration({
        status: RegistrationStatus.CONFIRMED,
        paymentDeferred: true,
      });
      mockPrismaService.registration.create.mockResolvedValue(created);

      const result = await service.createCampRegistration(userId, dtoDeferred);

      expect(mockPrismaService.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RegistrationStatus.CONFIRMED,
            paymentDeferred: true,
          }),
        }),
      );
      expect(result.jobRegistration?.status).toBe(RegistrationStatus.CONFIRMED);
      expect(result.jobRegistration?.paymentDeferred).toBe(true);
    });

    it('creates deferred + waitlisted as WAITLISTED + paymentDeferred=true (capacity beats deferral)', async () => {
      const dtoDeferred = { ...baseDto, deferPayment: true };
      // One full job triggers WAITLISTED.
      mockPrismaService.job.findUnique.mockResolvedValue({
        id: 'job-1',
        maxRegistrations: 0,
        staffOnly: false,
        registrations: [],
      });
      const created = buildCreatedRegistration({
        status: RegistrationStatus.WAITLISTED,
        paymentDeferred: true,
      });
      mockPrismaService.registration.create.mockResolvedValue(created);

      const result = await service.createCampRegistration(userId, dtoDeferred);

      expect(mockPrismaService.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RegistrationStatus.WAITLISTED,
            paymentDeferred: true,
          }),
        }),
      );
      expect(result.jobRegistration?.status).toBe(RegistrationStatus.WAITLISTED);
    });

    it('throws if terms are not accepted (before any DB write)', async () => {
      const dtoNoTerms = { ...baseDto, acceptedTerms: false };

      await expect(
        service.createCampRegistration(userId, dtoNoTerms),
      ).rejects.toThrow(/Terms and conditions/);

      expect(mockPrismaService.registration.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException if the user already has an active registration for the year', async () => {
      mockPrismaService.registration.findFirst.mockResolvedValue(buildCreatedRegistration());

      await expect(
        service.createCampRegistration(userId, baseDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propagates failure and rolls back atomically when a downstream camping-option write fails inside the transaction', async () => {
      // Stub user + jobs OK; the registration insert succeeds; but the
      // camping-option insert fails. The transaction wrapping the writes
      // guarantees the Registration is rolled back too — without this
      // wrap, CampingOptionRegistration rows have no FK to Registration
      // so deleting the registration manually would leave orphaned
      // camping-option rows and block retries.
      const created = buildCreatedRegistration({ status: RegistrationStatus.PENDING });
      mockPrismaService.registration.create.mockResolvedValueOnce(created);
      mockPrismaService.campingOption.findUnique.mockResolvedValueOnce({
        id: 'opt-1',
        name: 'Standard',
        fields: [],
      });
      mockPrismaService.campingOptionRegistration.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.campingOptionRegistration.create.mockRejectedValueOnce(new Error('boom'));

      const dtoWithOption = {
        ...baseDto,
        campingOptions: ['opt-1'],
      };

      await expect(
        service.createCampRegistration(userId, dtoWithOption),
      ).rejects.toThrow(/boom/);

      // The transaction should have been invoked (so rollback semantics
      // apply); no manual cleanup delete is needed.
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw ForbiddenException with the user-friendly message when user.allowRegistration is false', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...baseUser,
        allowRegistration: false,
      });
      // Simulate the policy service rejecting because allowRegistration=false.
      // The policy service's own spec covers the exact message; this test
      // verifies the integration surface — that the message reaches the
      // caller unchanged.
      mockPolicyService.assertCanCreateCampRegistration.mockRejectedValueOnce(
        new ForbiddenException(
          'Registration is not available for your account. Please contact an administrator.',
        ),
      );

      const call = service.createCampRegistration(userId, baseDto);

      await expect(call).rejects.toBeInstanceOf(ForbiddenException);
      await expect(call).rejects.toThrow(
        'Registration is not available for your account. Please contact an administrator.',
      );
    });

    it('should not count prior-year registrations toward capacity in createCampRegistration', async () => {
      // Job has maxRegistrations=1 with one CONFIRMED registration from a prior year.
      // Current registration year is 2026, but the existing registration is for 2025.
      mockCoreConfigService.findCurrent.mockResolvedValue({ registrationYear: 2026 });
      mockPrismaService.job.findUnique.mockResolvedValue({
        id: 'job-1',
        maxRegistrations: 1,
        staffOnly: false,
        registrations: [{ registration: { status: RegistrationStatus.CONFIRMED, year: 2025 } }],
      });
      const created = buildCreatedRegistration({ status: RegistrationStatus.PENDING });
      mockPrismaService.registration.create.mockResolvedValue(created);

      const result = await service.createCampRegistration(userId, baseDto);

      expect(mockPrismaService.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RegistrationStatus.PENDING,
          }),
        }),
      );
      expect(result.jobRegistration?.status).toBe(RegistrationStatus.PENDING);
    });

    it('should count same-year registrations toward capacity in createCampRegistration', async () => {
      // Job has maxRegistrations=1 with one CONFIRMED registration for the current year.
      mockCoreConfigService.findCurrent.mockResolvedValue({ registrationYear: 2026 });
      mockPrismaService.job.findUnique.mockResolvedValue({
        id: 'job-1',
        maxRegistrations: 1,
        staffOnly: false,
        registrations: [{ registration: { status: RegistrationStatus.CONFIRMED, year: 2026 } }],
      });
      const created = buildCreatedRegistration({ status: RegistrationStatus.WAITLISTED });
      mockPrismaService.registration.create.mockResolvedValue(created);

      const result = await service.createCampRegistration(userId, baseDto);

      expect(mockPrismaService.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RegistrationStatus.WAITLISTED,
          }),
        }),
      );
      expect(result.jobRegistration?.status).toBe(RegistrationStatus.WAITLISTED);
    });
  });

  describe('getMyCampRegistration', () => {
    const userId = 'user-123';

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
    });

    it('should return only current-year camping option registrations', async () => {
      mockCoreConfigService.findCurrent.mockResolvedValue({ registrationYear: 2026 });
      mockPrismaService.campingOptionRegistration.findMany.mockResolvedValue([
        { id: 'cor-1', campingOption: { fields: [] }, fieldValues: [] },
      ]);
      mockPrismaService.registration.findMany.mockResolvedValue([
        {
          id: 'registration-id',
          status: RegistrationStatus.CONFIRMED,
          jobs: [],
          payments: [{ id: 'payment-id', amount: 100 }],
        },
      ]);

      const result = await service.getMyCampRegistration(userId);

      expect(mockPrismaService.campingOptionRegistration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, registration: { year: 2026 } },
        })
      );
      expect(mockPrismaService.registration.findMany).toHaveBeenCalledWith({
        where: { userId, year: 2026 },
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
          payments: {
            select: expectedParticipantPaymentSelect,
          },
        },
      });
      expect(result.campingOptions).toHaveLength(1);
      expect(result).not.toHaveProperty(
        'jobRegistrations.0.payments.0.externalMethod',
      );
      expect(result).not.toHaveProperty(
        'jobRegistrations.0.payments.0.externalReference',
      );
      expect(result).not.toHaveProperty(
        'jobRegistrations.0.payments.0.idempotencyKey',
      );
      expect(result).not.toHaveProperty('jobRegistrations.0.payments.0.refunds');
    });

    it('should return hasRegistration false when user only has prior-year registrations', async () => {
      mockCoreConfigService.findCurrent.mockResolvedValue({ registrationYear: 2026 });
      // No camping options for current year
      mockPrismaService.campingOptionRegistration.findMany.mockResolvedValue([]);
      // No registrations for current year
      mockPrismaService.registration.findMany.mockResolvedValue([]);

      const result = await service.getMyCampRegistration(userId);

      expect(result.hasRegistration).toBe(false);
    });

    it('should return hasRegistration true when user has current-year camping options', async () => {
      mockCoreConfigService.findCurrent.mockResolvedValue({ registrationYear: 2026 });
      mockPrismaService.campingOptionRegistration.findMany.mockResolvedValue([
        { id: 'cor-1', campingOption: { fields: [] }, fieldValues: [] },
      ]);
      mockPrismaService.registration.findMany.mockResolvedValue([]);

      const result = await service.getMyCampRegistration(userId);

      expect(result.hasRegistration).toBe(true);
    });

    it('should return hasRegistration true when user has active current-year registration', async () => {
      mockCoreConfigService.findCurrent.mockResolvedValue({ registrationYear: 2026 });
      mockPrismaService.campingOptionRegistration.findMany.mockResolvedValue([]);
      mockPrismaService.registration.findMany.mockResolvedValue([
        { id: 'reg-1', status: RegistrationStatus.CONFIRMED, jobs: [], payments: [] },
      ]);

      const result = await service.getMyCampRegistration(userId);

      expect(result.hasRegistration).toBe(true);
    });

    it('should return hasRegistration false when only current-year registration is cancelled', async () => {
      mockCoreConfigService.findCurrent.mockResolvedValue({ registrationYear: 2026 });
      mockPrismaService.campingOptionRegistration.findMany.mockResolvedValue([]);
      mockPrismaService.registration.findMany.mockResolvedValue([
        { id: 'reg-1', status: RegistrationStatus.CANCELLED, jobs: [], payments: [] },
      ]);

      const result = await service.getMyCampRegistration(userId);

      expect(result.hasRegistration).toBe(false);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getMyCampRegistration('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
