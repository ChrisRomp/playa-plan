import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto, UpdateShiftDto } from './dto';
import { DayOfWeek } from '../common/enums/day-of-week.enum';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegistrationsService } from '../registrations/registrations.service';
import { CoreConfigService } from '../core-config/services/core-config.service';

describe('ShiftsController', () => {
  let controller: ShiftsController;
  let service: ShiftsService;
  let mockPrismaService: Record<string, Record<string, jest.Mock>>;
  let mockCoreConfigService: Record<string, jest.Mock>;

  const mockShift = {
    id: 'test-id',
    name: 'Test Shift',
    description: 'Test Description',
    startTime: '09:00',
    endTime: '17:00',
    campId: 'camp-id',
    dayOfWeek: DayOfWeek.MONDAY,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const mockUpdatedShift = {
    ...mockShift,
    name: 'Updated Shift',
    description: 'Updated Description',
  };

  beforeEach(async () => {
    const mockShiftsService = {
      create: jest.fn(() => Promise.resolve(mockShift)),
      findAll: jest.fn(() => Promise.resolve([mockShift])),
      findOne: jest.fn(() => Promise.resolve(mockShift)),
      update: jest.fn(() => Promise.resolve(mockUpdatedShift)),
      remove: jest.fn(() => Promise.resolve(mockShift)),
    };

    const mockRegistrationsService = {
      create: jest.fn(() => Promise.resolve({ id: 'reg-id', userId: 'user-id', jobId: 'job-id' })),
      findByUser: jest.fn(() => Promise.resolve([])),
      findByJob: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(() => Promise.resolve({ id: 'reg-id', userId: 'user-id', jobId: 'job-id' })),
      update: jest.fn(() => Promise.resolve({ id: 'reg-id', userId: 'user-id', jobId: 'job-id', status: 'CANCELLED' })),
    };

    mockPrismaService = {
      shift: {
        findMany: jest.fn(),
      },
    };

    mockCoreConfigService = {
      findCurrent: jest.fn().mockResolvedValue({ registrationYear: 2026 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShiftsController],
      providers: [
        {
          provide: ShiftsService,
          useValue: mockShiftsService,
        },
        {
          provide: RegistrationsService,
          useValue: mockRegistrationsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CoreConfigService,
          useValue: mockCoreConfigService,
        },
      ],
    }).compile();

    controller = module.get<ShiftsController>(ShiftsController);
    service = module.get<ShiftsService>(ShiftsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a shift', async () => {
      const mockCreateShiftDto: CreateShiftDto = {
        name: 'Test Shift',
        description: 'Test Description',
        startTime: '09:00',
        endTime: '17:00',
        dayOfWeek: DayOfWeek.MONDAY
      };

      const result = await controller.create(mockCreateShiftDto);

      expect(result).toEqual(mockShift);
      expect(service.create).toHaveBeenCalledWith(mockCreateShiftDto);
    });
  });

  describe('findAll', () => {
    it('should return all shifts', async () => {
      const result = await controller.findAll();

      expect(result).toEqual([mockShift]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a shift by id', async () => {
      const result = await controller.findOne('test-id');

      expect(result).toEqual(mockShift);
      expect(service.findOne).toHaveBeenCalledWith('test-id');
    });
  });

  describe('update', () => {
    it('should update a shift', async () => {
      const updateShiftDto: UpdateShiftDto = {
        name: 'Updated Shift',
        description: 'Updated Description'
      };

      const result = await controller.update('test-id', updateShiftDto);

      expect(result).toEqual(mockUpdatedShift);
      expect(service.update).toHaveBeenCalledWith('test-id', updateShiftDto);
    });
  });

  describe('remove', () => {
    it('should remove a shift', async () => {
      const result = await controller.remove('test-id');

      expect(result).toEqual(mockShift);
      expect(service.remove).toHaveBeenCalledWith('test-id');
    });
  });

  describe('findAllWithJobsAndRegistrations', () => {
    it('should filter registrations by the configured registration year', async () => {
      const mockShiftsWithJobs = [
        {
          id: 'shift-1',
          name: 'Morning Shift',
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '12:00',
          jobs: [
            {
              id: 'job-1',
              name: 'Gate',
              location: 'Front Gate',
              maxRegistrations: 5,
              categoryId: 'cat-1',
              category: { id: 'cat-1', name: 'Security' },
              registrations: [
                {
                  id: 'reg-job-1',
                  registration: {
                    year: 2026,
                    user: {
                      id: 'user-1',
                      firstName: 'Jane',
                      lastName: 'Doe',
                      playaName: 'Sparkle',
                    },
                  },
                },
              ],
            },
          ],
        },
      ];

      mockPrismaService.shift.findMany.mockResolvedValue(mockShiftsWithJobs);

      const result = await controller.findAllWithJobsAndRegistrations();

      // Verify CoreConfigService was called to get the registration year
      expect(mockCoreConfigService.findCurrent).toHaveBeenCalled();

      // Verify Prisma query includes year filter
      expect(mockPrismaService.shift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            jobs: expect.objectContaining({
              include: expect.objectContaining({
                registrations: expect.objectContaining({
                  where: {
                    registration: {
                      year: 2026,
                    },
                  },
                }),
              }),
            }),
          }),
        }),
      );

      // Verify response structure
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].jobs[0].registrations).toHaveLength(1);
      expect(result.shifts[0].jobs[0].registrations[0].user.firstName).toBe('Jane');
    });
  });
}); 