import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto, UpdateShiftDto } from './dto';

describe('ShiftsController', () => {
  let controller: ShiftsController;
  let service: ShiftsService;

  const mockShift = {
    id: 'test-id',
    startTime: new Date('2023-06-01T09:00:00Z'),
    endTime: new Date('2023-06-01T17:00:00Z'),
    maxRegistrations: 10,
    campId: 'camp-id',
    jobId: 'job-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockShiftsService = {
    create: jest.fn().mockResolvedValue(mockShift),
    findAll: jest.fn().mockResolvedValue([mockShift]),
    findOne: jest.fn().mockResolvedValue(mockShift),
    update: jest.fn().mockResolvedValue({
      ...mockShift,
      maxRegistrations: 15,
    }),
    remove: jest.fn().mockResolvedValue(mockShift),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShiftsController],
      providers: [
        {
          provide: ShiftsService,
          useValue: mockShiftsService,
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
      const createShiftDto: CreateShiftDto = {
        startTime: '2023-06-01T09:00:00Z',
        endTime: '2023-06-01T17:00:00Z',
        maxRegistrations: 10,
        campId: 'camp-id',
        jobId: 'job-id',
      };

      const result = await controller.create(createShiftDto);

      expect(result).toEqual(mockShift);
      expect(service.create).toHaveBeenCalledWith(createShiftDto);
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
        maxRegistrations: 15,
      };

      const result = await controller.update('test-id', updateShiftDto);

      expect(result).toEqual({
        ...mockShift,
        maxRegistrations: 15,
      });
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