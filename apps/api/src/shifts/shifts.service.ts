import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { Prisma, Shift } from '@prisma/client';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new shift
   * @param createShiftDto - The data to create the shift with
   * @returns The created shift
   */
  async create(createShiftDto: CreateShiftDto): Promise<Shift> {
    return this.prisma.shift.create({
      data: {
        startTime: createShiftDto.startTime,
        endTime: createShiftDto.endTime,
        maxRegistrations: createShiftDto.maxParticipants,
        dayOfWeek: createShiftDto.dayOfWeek,
        camp: { connect: { id: createShiftDto.location } },
        job: { connect: { id: String(createShiftDto.jobId) } },
      },
    });
  }

  /**
   * Find all shifts
   * @returns An array of shifts
   */
  async findAll(): Promise<Shift[]> {
    return this.prisma.shift.findMany();
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
        camp: true,
        job: true,
        registrations: true,
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

    if (updateShiftDto.startTime) {
      data.startTime = updateShiftDto.startTime;
    }

    if (updateShiftDto.endTime) {
      data.endTime = updateShiftDto.endTime;
    }

    if (updateShiftDto.maxParticipants) {
      data.maxRegistrations = updateShiftDto.maxParticipants;
    }

    if (updateShiftDto.dayOfWeek) {
      data.dayOfWeek = updateShiftDto.dayOfWeek;
    }

    if (updateShiftDto.location) {
      data.camp = { connect: { id: updateShiftDto.location } };
    }

    if (updateShiftDto.jobId) {
      data.job = { connect: { id: String(updateShiftDto.jobId) } };
    }

    return this.prisma.shift.update({
      where: { id },
      data,
      include: {
        camp: true,
        job: true,
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
} 