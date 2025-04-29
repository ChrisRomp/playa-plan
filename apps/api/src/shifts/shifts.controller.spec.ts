import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto, UpdateShiftDto } from './dto';
import { DayOfWeek } from '../common/enums/day-of-week.enum';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegistrationsService } from '../registrations/registrations.service';

describe('ShiftsController', () => {
  let controller: ShiftsController;
  let service: ShiftsService;

  const mockShift = {
    id: 'test-id',
    startTime: new Date('2023-06-01T09:00:00Z'),
    endTime: new Date('2023-06-01T17:00:00Z'),
    maxRegistrations: 10,
    campId: 'camp-id',
    jobId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const mockUpdatedShift = {
    ...mockShift,
    maxRegistrations: 15,
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
      create: jest.fn(() => Promise.resolve({ id: 'reg-id', userId: 'user-id', shiftId: 'test-id' })),
      findByUser: jest.fn(() => Promise.resolve([])),
      findByShift: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(() => Promise.resolve({ id: 'reg-id', userId: 'user-id', shiftId: 'test-id' })),
      update: jest.fn(() => Promise.resolve({ id: 'reg-id', userId: 'user-id', shiftId: 'test-id', status: 'CANCELLED' })),
    };

    const mockPrismaService = {
      // Add any necessary mock methods here
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
        maxParticipants: 5,
        startTime: new Date('2023-06-01T09:00:00Z'),
        endTime: new Date('2023-06-01T17:00:00Z'),
        dayOfWeek: DayOfWeek.MONDAY,
        location: 'test-camp-id',
        jobId: 1
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
        maxParticipants: 15,
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
}); 