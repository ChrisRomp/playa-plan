import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsService } from './shifts.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { DayOfWeek } from '../common/enums/day-of-week.enum';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let prismaService: PrismaService;

  const mockShift = {
    id: 'test-id',
    name: 'Test Shift',
    description: 'Test Description',
    startTime: '09:00',
    endTime: '17:00',
    dayOfWeek: DayOfWeek.MONDAY,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockCreateShiftDto = {
    name: 'Test Shift',
    description: 'Test Description',
    startTime: '09:00',
    endTime: '17:00',
    dayOfWeek: DayOfWeek.MONDAY
  };

  const mockUpdateShiftDto = {
    name: 'Updated Shift',
    description: 'Updated Description',
    startTime: '10:00',
    endTime: '18:00',
    dayOfWeek: DayOfWeek.TUESDAY
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftsService,
        {
          provide: PrismaService,
          useValue: {
            shift: {
              create: jest.fn().mockResolvedValue(mockShift),
              findMany: jest.fn().mockResolvedValue([mockShift]),
              findUnique: jest.fn().mockResolvedValue(mockShift),
              update: jest.fn().mockResolvedValue(mockShift),
              delete: jest.fn().mockResolvedValue(mockShift),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ShiftsService>(ShiftsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a shift', async () => {
      const result = await service.create(mockCreateShiftDto);
      expect(result).toEqual(mockShift);
      expect(prismaService.shift.create).toHaveBeenCalledWith({
        data: {
          name: mockCreateShiftDto.name,
          description: mockCreateShiftDto.description,
          startTime: mockCreateShiftDto.startTime,
          endTime: mockCreateShiftDto.endTime,
          dayOfWeek: mockCreateShiftDto.dayOfWeek,
          jobs: { create: [] }
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return an array of shifts', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockShift]);
      expect(prismaService.shift.findMany).toHaveBeenCalledWith({
        include: {
          jobs: true
        }
      });
    });
  });

  describe('findOne', () => {
    it('should return a shift', async () => {
      const result = await service.findOne('test-id');
      expect(result).toEqual(mockShift);
      expect(prismaService.shift.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        include: {
          jobs: true,
        },
      });
    });

    it('should throw NotFoundException if shift not found', async () => {
      jest.spyOn(prismaService.shift, 'findUnique').mockResolvedValueOnce(null);
      await expect(service.findOne('test-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a shift', async () => {
      const result = await service.update('test-id', mockUpdateShiftDto);
      expect(result).toEqual(mockShift);
      expect(prismaService.shift.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: {
          name: mockUpdateShiftDto.name,
          description: mockUpdateShiftDto.description,
          startTime: mockUpdateShiftDto.startTime,
          endTime: mockUpdateShiftDto.endTime,
          dayOfWeek: mockUpdateShiftDto.dayOfWeek,
        },
        include: {
          jobs: true,
        },
      });
    });
  });

  describe('remove', () => {
    it('should delete a shift', async () => {
      const result = await service.remove('test-id');
      expect(result).toEqual(mockShift);
      expect(prismaService.shift.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });
  });
}); 