import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsService } from './shifts.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CreateShiftDto } from './dto';
import { DayOfWeek } from '../common/enums/day-of-week.enum';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let prismaService: PrismaService;

  const mockShift = {
    id: 'test-id',
    name: 'Test Shift',
    description: 'Test Description',
    startTime: new Date('2023-06-01T09:00:00Z'),
    endTime: new Date('2023-06-01T17:00:00Z'),
    dayOfWeek: DayOfWeek.MONDAY,
    campId: 'camp-id',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockCreateShiftDto = {
    name: 'Test Shift',
    description: 'Test Description',
    startTime: new Date('2023-06-01T09:00:00Z'),
    endTime: new Date('2023-06-01T17:00:00Z'),
    dayOfWeek: DayOfWeek.MONDAY,
    campId: 'test-camp-id'
  };

  const mockUpdateShiftDto = {
    name: 'Updated Shift',
    description: 'Updated Description',
    startTime: new Date('2023-07-01T10:00:00Z'),
    endTime: new Date('2023-07-01T18:00:00Z'),
    dayOfWeek: DayOfWeek.TUESDAY,
    campId: 'updated-camp-id'
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
          camp: { connect: { id: mockCreateShiftDto.campId } },
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
          camp: true,
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
          camp: true,
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
          camp: { connect: { id: mockUpdateShiftDto.campId } },
        },
        include: {
          camp: true,
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