import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateShiftDto, UpdateShiftDto } from './dto';
import { Shift } from '@prisma/client';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new shift
   * @param createShiftDto - The data to create the shift
   * @returns The created shift
   */
  async create(createShiftDto: CreateShiftDto): Promise<Shift> {
    // Parse date strings to Date objects
    const startTime = new Date(createShiftDto.startTime);
    const endTime = new Date(createShiftDto.endTime);

    return this.prisma.shift.create({
      data: {
        startTime,
        endTime,
        maxRegistrations: createShiftDto.maxRegistrations,
        camp: { connect: { id: createShiftDto.campId } },
        job: { connect: { id: createShiftDto.jobId } },
      },
    });
  }

  /**
   * Get all shifts
   * @returns All shifts
   */
  async findAll(): Promise<Shift[]> {
    return this.prisma.shift.findMany({
      include: {
        camp: true,
        job: true,
      },
    });
  }

  /**
   * Get a shift by ID
   * @param id - The ID of the shift to find
   * @returns The shift, if found
   * @throws NotFoundException if not found
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
   * @param id - The ID of the shift to update
   * @param updateShiftDto - The data to update the shift with
   * @returns The updated shift
   * @throws NotFoundException if not found
   */
  async update(id: string, updateShiftDto: UpdateShiftDto): Promise<Shift> {
    // Check if shift exists
    await this.findOne(id);

    // Parse date strings to Date objects if provided
    const data: any = { ...updateShiftDto };
    
    if (updateShiftDto.startTime) {
      data.startTime = new Date(updateShiftDto.startTime);
    }
    
    if (updateShiftDto.endTime) {
      data.endTime = new Date(updateShiftDto.endTime);
    }
    
    // Handle relations
    if (updateShiftDto.campId) {
      data.camp = { connect: { id: updateShiftDto.campId } };
      delete data.campId;
    }
    
    if (updateShiftDto.jobId) {
      data.job = { connect: { id: updateShiftDto.jobId } };
      delete data.jobId;
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
   * Delete a shift
   * @param id - The ID of the shift to delete
   * @returns The deleted shift
   * @throws NotFoundException if not found
   */
  async remove(id: string): Promise<Shift> {
    // Check if shift exists
    await this.findOne(id);

    return this.prisma.shift.delete({
      where: { id },
    });
  }
} 