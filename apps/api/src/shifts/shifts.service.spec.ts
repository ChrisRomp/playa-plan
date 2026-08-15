import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsService } from './shifts.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { DayOfWeek } from '../common/enums/day-of-week.enum';
import { CoreConfigService } from '../core-config/services/core-config.service';
import { CAPACITY_RESERVING_STATUSES } from '../registrations/constants/registration-status.constants';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let prismaService: PrismaService;
  let coreConfigService: CoreConfigService;

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
        {
          provide: CoreConfigService,
          useValue: {
            findCurrent: jest.fn().mockResolvedValue({ registrationYear: 2026 }),
          },
        },
      ],
    }).compile();

    service = module.get<ShiftsService>(ShiftsService);
    prismaService = module.get<PrismaService>(PrismaService);
    coreConfigService = module.get<CoreConfigService>(CoreConfigService);
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

  describe('getWorkSchedule', () => {
    it('shouldFilterByConfiguredYearAndOrderScheduleData', async () => {
          jest.spyOn(prismaService.shift, 'findMany').mockResolvedValueOnce([
            {
              id: 'thursday-early',
              name: 'Thursday Early',
              description: null,
              startTime: '8:00',
              endTime: '09:00',
              dayOfWeek: DayOfWeek.THURSDAY,
              createdAt: new Date(),
              updatedAt: new Date(),
              jobs: [],
            },
            {
              id: 'thursday',
              name: 'Thursday AM',
              description: null,
              startTime: '09:30',
              endTime: '14:30',
              dayOfWeek: DayOfWeek.THURSDAY,
              createdAt: new Date(),
              updatedAt: new Date(),
              jobs: [
                {
                  id: 'job-b',
                  name: 'Manifest',
                  location: 'Airport',
                  maxRegistrations: 2,
                  categoryId: 'category',
                  active: true,
                  alwaysRequired: false,
                  staffOnly: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  shiftId: 'thursday',
                  category: {
                    id: 'category',
                    name: 'Operations',
                    staffOnly: true,
                  },
                  registrations: [
                    {
                      id: 'registration-b',
                      registration: {
                        user: {
                          id: 'user-b',
                          firstName: 'Zoe',
                          lastName: 'Alpha',
                          playaName: null,
                        },
                      },
                    },
                    {
                      id: 'registration-a',
                      registration: {
                        user: {
                          id: 'user-a',
                          firstName: 'Amy',
                          lastName: 'Alpha',
                          playaName: 'Spark',
                        },
                      },
                    },
                  ],
                },
                {
                  id: 'job-a',
                  name: 'Airport',
                  location: 'Runway',
                  maxRegistrations: 1,
                  categoryId: 'category',
                  active: true,
                  alwaysRequired: false,
                  staffOnly: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  shiftId: 'thursday',
                  category: {
                    id: 'category',
                    name: 'Operations',
                    staffOnly: false,
                  },
                  registrations: [],
                },
              ],
            },
            {
              id: 'thursday-afternoon',
              name: 'Thursday Afternoon',
              description: null,
              startTime: '13:00',
              endTime: '14:00',
              dayOfWeek: DayOfWeek.THURSDAY,
              createdAt: new Date(),
              updatedAt: new Date(),
              jobs: [],
            },
          ] as never);

          const actualSchedule = await service.getWorkSchedule(DayOfWeek.THURSDAY);

          expect(coreConfigService.findCurrent).toHaveBeenCalled();
          expect(prismaService.shift.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { dayOfWeek: DayOfWeek.THURSDAY },
              include: expect.objectContaining({
                jobs: expect.objectContaining({
                  where: {
                    OR: [
                      { active: true },
                      {
                        registrations: {
                          some: {
                            registration: {
                              year: 2026,
                              status: { in: [...CAPACITY_RESERVING_STATUSES] },
                            },
                          },
                        },
                      },
                    ],
                  },
                  include: expect.objectContaining({
                    registrations: expect.objectContaining({
                      where: {
                        registration: {
                          year: 2026,
                          status: { in: [...CAPACITY_RESERVING_STATUSES] },
                        },
                      },
                    }),
                  }),
                }),
              }),
            })
          );
          expect(actualSchedule.shifts.map(shift => shift.id)).toEqual([
            'thursday-early',
            'thursday',
            'thursday-afternoon',
          ]);
          expect(actualSchedule.shifts[1].jobs.map(job => job.name)).toEqual([
            'Airport',
            'Manifest',
          ]);
          expect(actualSchedule.shifts[1].jobs.map(job => job.staffOnly)).toEqual([
            false,
            true,
          ]);
          expect(
            actualSchedule.shifts[1].jobs[1].registrations.map(
              registration => registration.user.firstName
            )
          ).toEqual(['Amy', 'Zoe']);
    });

    it('shouldExcludeStaffOnlyJobsWhenRequested', async () => {
      jest
        .spyOn(prismaService.shift, 'findMany')
        .mockResolvedValueOnce([
          {
            id: 'staff-only-shift',
            name: 'Staff Only Shift',
            description: null,
            startTime: '09:00',
            endTime: '10:00',
            dayOfWeek: DayOfWeek.WEDNESDAY,
            createdAt: new Date(),
            updatedAt: new Date(),
            jobs: [],
          },
        ] as never);

      const actualSchedule = await service.getWorkSchedule(undefined, 2026, false);

      expect(prismaService.shift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            jobs: expect.objectContaining({
              where: expect.objectContaining({
                category: { staffOnly: false },
              }),
            }),
          }),
        })
      );
      expect(actualSchedule.shifts).toEqual([]);
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