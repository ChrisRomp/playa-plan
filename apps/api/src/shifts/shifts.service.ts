import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { DayOfWeek, Prisma, Shift } from '@prisma/client';
import { CoreConfigService } from '../core-config/services/core-config.service';
import { CAPACITY_RESERVING_STATUSES } from '../registrations/constants/registration-status.constants';
import { WorkScheduleData } from './models/work-schedule-data';

const DAY_OF_WEEK_ORDER: Readonly<Record<DayOfWeek, number>> = {
  [DayOfWeek.PRE_OPENING]: 0,
  [DayOfWeek.OPENING_SUNDAY]: 1,
  [DayOfWeek.MONDAY]: 2,
  [DayOfWeek.TUESDAY]: 3,
  [DayOfWeek.WEDNESDAY]: 4,
  [DayOfWeek.THURSDAY]: 5,
  [DayOfWeek.FRIDAY]: 6,
  [DayOfWeek.SATURDAY]: 7,
  [DayOfWeek.CLOSING_SUNDAY]: 8,
  [DayOfWeek.POST_EVENT]: 9,
};

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coreConfigService: CoreConfigService
  ) {}

  /**
   * Create a new shift
   * @param createShiftDto - The data to create the shift with
   * @returns The created shift
   */
  async create(createShiftDto: CreateShiftDto): Promise<Shift> {
    return this.prisma.shift.create({
      data: {
        name: createShiftDto.name,
        description: createShiftDto.description,
        startTime: createShiftDto.startTime,
        endTime: createShiftDto.endTime,
        dayOfWeek: createShiftDto.dayOfWeek,
        jobs: { create: [] } // Empty jobs array to satisfy the Prisma schema
      },
    });
  }

  /**
   * Find all shifts
   * @returns An array of shifts
   */
  async findAll(): Promise<Shift[]> {
    return this.prisma.shift.findMany({
      include: {
        jobs: true,
      },
    });
  }

  /** Returns the printable work schedule for the configured registration year. */
  async getWorkSchedule(
    dayOfWeek?: DayOfWeek,
    requestedYear?: number,
    includeStaffOnly = true
  ): Promise<WorkScheduleData> {
    const registrationYear =
      requestedYear ?? (await this.coreConfigService.findCurrent()).registrationYear;
    const shifts = await this.prisma.shift.findMany({
      ...(dayOfWeek ? { where: { dayOfWeek } } : {}),
      include: {
        jobs: {
          where: {
            ...(!includeStaffOnly ? { category: { staffOnly: false } } : {}),
            OR: [
              { active: true },
              {
                registrations: {
                  some: {
                    registration: {
                      year: registrationYear,
                      status: { in: [...CAPACITY_RESERVING_STATUSES] },
                    },
                  },
                },
              },
            ],
          },
          include: {
            category: true,
            registrations: {
              where: {
                registration: {
                  year: registrationYear,
                  status: { in: [...CAPACITY_RESERVING_STATUSES] },
                },
              },
              include: {
                registration: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        playaName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      shifts: shifts
        .map(shift => ({
          id: shift.id,
          name: shift.name,
          dayOfWeek: shift.dayOfWeek,
          startTime: shift.startTime,
          endTime: shift.endTime,
          jobs: shift.jobs
            .map(job => ({
              id: job.id,
              name: job.name,
              location: job.location,
              maxRegistrations: job.maxRegistrations,
              staffOnly: job.category.staffOnly,
              categoryId: job.categoryId,
              category: {
                id: job.category.id,
                name: job.category.name,
              },
              registrations: job.registrations
                .map(registration => ({
                  id: registration.id,
                  user: {
                    id: registration.registration.user.id,
                    firstName: registration.registration.user.firstName,
                    lastName: registration.registration.user.lastName,
                    playaName: registration.registration.user.playaName,
                  },
                }))
                .sort((left, right) => this.compareUsers(left.user, right.user)),
            }))
            .sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .sort((left, right) => {
          const dayComparison =
            DAY_OF_WEEK_ORDER[left.dayOfWeek] - DAY_OF_WEEK_ORDER[right.dayOfWeek];
          if (dayComparison !== 0) {
            return dayComparison;
          }
          const timeComparison =
            this.getStartTimeMinutes(left.startTime) -
            this.getStartTimeMinutes(right.startTime);
          return timeComparison !== 0 ? timeComparison : left.name.localeCompare(right.name);
        }),
    };
  }

  private getStartTimeMinutes(startTime: string): number {
    const [hours, minutes] = startTime.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Find a shift by id
   * @param id - The id of the shift to find
   * @returns The found shift
   * @throws NotFoundException if the shift is not found
   */
  async findOne(id: string): Promise<Shift> {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: {
        jobs: true,
      },
    });

    if (!shift) {
      throw new NotFoundException(`Shift with ID ${id} not found`);
    }

    return shift;
  }

  /**
   * Update a shift
   * @param id - The id of the shift to update
   * @param updateShiftDto - The data to update the shift with
   * @returns The updated shift
   */
  async update(id: string, updateShiftDto: UpdateShiftDto): Promise<Shift> {
    // Create data object for Prisma update
    const data: Prisma.ShiftUpdateInput = {};

    if (updateShiftDto.name) {
      data.name = updateShiftDto.name;
    }

    if (updateShiftDto.description) {
      data.description = updateShiftDto.description;
    }

    if (updateShiftDto.startTime) {
      data.startTime = updateShiftDto.startTime;
    }

    if (updateShiftDto.endTime) {
      data.endTime = updateShiftDto.endTime;
    }

    if (updateShiftDto.dayOfWeek) {
      data.dayOfWeek = updateShiftDto.dayOfWeek;
    }

    // Camp field has been removed

    return this.prisma.shift.update({
      where: { id },
      data,
      include: {
        jobs: true,
      },
    });
  }

  /**
   * Remove a shift
   * @param id - The id of the shift to remove
   * @returns The removed shift
   */
  async remove(id: string): Promise<Shift> {
    return this.prisma.shift.delete({
      where: { id },
    });
  }

  private compareUsers(
    left: { readonly firstName: string; readonly lastName: string },
    right: { readonly firstName: string; readonly lastName: string }
  ): number {
    const lastNameComparison = left.lastName.localeCompare(right.lastName);
    return lastNameComparison !== 0
      ? lastNameComparison
      : left.firstName.localeCompare(right.firstName);
  }
}