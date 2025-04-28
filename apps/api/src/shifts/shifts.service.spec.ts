import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsService } from './shifts.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CreateShiftDto } from './dto';
import { DayOfWeek } from '@libs/types/enums/day-of-week.enum';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let prismaService: PrismaService;

  const mockShift = {
    id: 'test-id',
    startTime: new Date('2023-06-01T09:00:00Z'),
    endTime: new Date('2023-06-01T17:00:00Z'),
    maxRegistrations: 10,
    dayOfWeek: DayOfWeek.MONDAY,
    campId: 'camp-id',
    jobId: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockCreateShiftDto = {
    title: 'Test Shift',
    description: 'Test Description',
    maxWorkers: 5,
    startTime: new Date('2023-06-01T09:00:00Z'),
    endTime: new Date('2023-06-01T17:00:00Z'),
    dayOfWeek: DayOfWeek.MONDAY,
    campId: 'test-camp-id',
    jobId: 1
  };

  const mockUpdateShiftDto = {
    startTime: new Date('2023-07-01T10:00:00Z'),
    endTime: new Date('2023-07-01T18:00:00Z'),
    maxWorkers: 15,
    dayOfWeek: DayOfWeek.TUESDAY,
    campId: 'updated-camp-id',
    jobId: 'updated-job-id'
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
          startTime: mockCreateShiftDto.startTime,
          endTime: mockCreateShiftDto.endTime,
          maxRegistrations: mockCreateShiftDto.maxWorkers,
          dayOfWeek: mockCreateShiftDto.dayOfWeek,
          camp: { connect: { id: mockCreateShiftDto.campId } },
          job: { connect: { id: mockCreateShiftDto.jobId } },
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return an array of shifts', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockShift]);
      expect(prismaService.shift.findMany).toHaveBeenCalled();
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
          job: true,
          registrations: true,
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
          startTime: mockUpdateShiftDto.startTime,
          endTime: mockUpdateShiftDto.endTime,
          maxRegistrations: mockUpdateShiftDto.maxWorkers,
          dayOfWeek: mockUpdateShiftDto.dayOfWeek,
          ...(mockUpdateShiftDto.campId ? { camp: { connect: { id: mockUpdateShiftDto.campId } } } : {}),
          ...(mockUpdateShiftDto.jobId ? { job: { connect: { id: mockUpdateShiftDto.jobId } } } : {}),
        },
        include: {
          camp: true,
          job: true,
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