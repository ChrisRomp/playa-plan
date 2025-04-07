import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsService } from './shifts.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CreateShiftDto } from './dto';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    shift: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

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

  const mockCreateShiftDto: CreateShiftDto = {
    startTime: '2023-06-01T09:00:00Z',
    endTime: '2023-06-01T17:00:00Z',
    maxRegistrations: 10,
    campId: 'camp-id',
    jobId: 'job-id',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ShiftsService>(ShiftsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a shift', async () => {
      mockPrismaService.shift.create.mockResolvedValue(mockShift);

      const result = await service.create(mockCreateShiftDto);

      expect(result).toEqual(mockShift);
      expect(mockPrismaService.shift.create).toHaveBeenCalledWith({
        data: {
          startTime: new Date(mockCreateShiftDto.startTime),
          endTime: new Date(mockCreateShiftDto.endTime),
          maxRegistrations: mockCreateShiftDto.maxRegistrations,
          camp: { connect: { id: mockCreateShiftDto.campId } },
          job: { connect: { id: mockCreateShiftDto.jobId } },
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return all shifts', async () => {
      mockPrismaService.shift.findMany.mockResolvedValue([mockShift]);

      const result = await service.findAll();

      expect(result).toEqual([mockShift]);
      expect(mockPrismaService.shift.findMany).toHaveBeenCalledWith({
        include: {
          camp: true,
          job: true,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a shift by id', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(mockShift);

      const result = await service.findOne('test-id');

      expect(result).toEqual(mockShift);
      expect(mockPrismaService.shift.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        include: {
          camp: true,
          job: true,
          registrations: true,
        },
      });
    });

    it('should throw NotFoundException if shift not found', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(null);

      await expect(service.findOne('not-found-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.shift.findUnique).toHaveBeenCalledWith({
        where: { id: 'not-found-id' },
        include: {
          camp: true,
          job: true,
          registrations: true,
        },
      });
    });
  });

  describe('update', () => {
    it('should update a shift', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(mockShift);
      mockPrismaService.shift.update.mockResolvedValue({
        ...mockShift,
        maxRegistrations: 15,
      });

      const result = await service.update('test-id', {
        maxRegistrations: 15,
      });

      expect(result).toEqual({
        ...mockShift,
        maxRegistrations: 15,
      });
      expect(mockPrismaService.shift.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { maxRegistrations: 15 },
        include: {
          camp: true,
          job: true,
        },
      });
    });

    it('should throw NotFoundException if shift to update not found', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(null);

      await expect(
        service.update('not-found-id', { maxRegistrations: 15 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle date fields correctly', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(mockShift);
      mockPrismaService.shift.update.mockResolvedValue({
        ...mockShift,
        startTime: new Date('2023-07-01T10:00:00Z'),
      });

      const result = await service.update('test-id', {
        startTime: '2023-07-01T10:00:00Z',
      });

      expect(result).toEqual({
        ...mockShift,
        startTime: new Date('2023-07-01T10:00:00Z'),
      });
      expect(mockPrismaService.shift.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { startTime: new Date('2023-07-01T10:00:00Z') },
        include: {
          camp: true,
          job: true,
        },
      });
    });

    it('should handle relation fields correctly', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(mockShift);
      mockPrismaService.shift.update.mockResolvedValue({
        ...mockShift,
        campId: 'new-camp-id',
      });

      const result = await service.update('test-id', {
        campId: 'new-camp-id',
      });

      expect(result).toEqual({
        ...mockShift,
        campId: 'new-camp-id',
      });
      expect(mockPrismaService.shift.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { camp: { connect: { id: 'new-camp-id' } } },
        include: {
          camp: true,
          job: true,
        },
      });
    });
  });

  describe('remove', () => {
    it('should delete a shift', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(mockShift);
      mockPrismaService.shift.delete.mockResolvedValue(mockShift);

      const result = await service.remove('test-id');

      expect(result).toEqual(mockShift);
      expect(mockPrismaService.shift.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });

    it('should throw NotFoundException if shift to delete not found', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(null);

      await expect(service.remove('not-found-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
}); 