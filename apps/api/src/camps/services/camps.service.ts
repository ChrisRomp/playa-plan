import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Camp } from '@prisma/client';
import { CreateCampDto } from '../dto/create-camp.dto';
import { UpdateCampDto } from '../dto/update-camp.dto';

/**
 * Service for handling camp related operations
 */
@Injectable()
export class CampsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all camps in the system
   * @param includeInactive - Whether to include inactive camps, defaults to false
   * @returns Array of camps
   */
  async findAll(includeInactive = false): Promise<Camp[]> {
    return this.prisma.camp.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Find upcoming camps (camps with start dates in the future)
   * @returns Array of upcoming camps
   */
  async findUpcoming(): Promise<Camp[]> {
    const now = new Date();
    return this.prisma.camp.findMany({
      where: {
        isActive: true,
        startDate: {
          gt: now,
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Find current camps (camps that are currently active)
   * @returns Array of current camps
   */
  async findCurrent(): Promise<Camp[]> {
    const now = new Date();
    return this.prisma.camp.findMany({
      where: {
        isActive: true,
        startDate: {
          lte: now,
        },
        endDate: {
          gte: now,
        },
      },
    });
  }

  /**
   * Find a camp by its ID
   * @param id - Camp ID to find
   * @returns The camp or throws NotFoundException if not found
   */
  async findById(id: string): Promise<Camp> {
    const camp = await this.prisma.camp.findUnique({
      where: { id },
    });

    if (!camp) {
      throw new NotFoundException(`Camp with ID ${id} not found`);
    }

    return camp;
  }

  /**
   * Create a new camp
   * @param createCampDto - Data for creating the camp
   * @returns The newly created camp
   */
  async create(createCampDto: CreateCampDto): Promise<Camp> {
    const { startDate, endDate, ...rest } = createCampDto;

    // Validate that start date is before end date
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (startDateObj >= endDateObj) {
      throw new ConflictException('Start date must be before end date');
    }

    return this.prisma.camp.create({
      data: {
        ...rest,
        startDate: startDateObj,
        endDate: endDateObj,
      },
    });
  }

  /**
   * Update an existing camp
   * @param id - ID of the camp to update
   * @param updateCampDto - Data to update
   * @returns The updated camp
   * @throws NotFoundException if the camp is not found
   */
  async update(id: string, updateCampDto: UpdateCampDto): Promise<Camp> {
    // Verify camp exists
    await this.findById(id);
    
    const { startDate, endDate, ...rest } = updateCampDto;
    const data: any = { ...rest };

    // Add dates to update data if provided, ensuring they're valid Date objects
    if (startDate) {
      data.startDate = new Date(startDate);
    }

    if (endDate) {
      data.endDate = new Date(endDate);
    }

    // If both dates are provided, validate that start is before end
    if (startDate && endDate) {
      if (new Date(startDate) >= new Date(endDate)) {
        throw new ConflictException('Start date must be before end date');
      }
    } else if (startDate) {
      // If only start date provided, make sure it's before existing end date
      const existingCamp = await this.prisma.camp.findUnique({
        where: { id },
        select: { endDate: true },
      });
      
      if (existingCamp && new Date(startDate) >= existingCamp.endDate) {
        throw new ConflictException('Start date must be before end date');
      }
    } else if (endDate) {
      // If only end date provided, make sure it's after existing start date
      const existingCamp = await this.prisma.camp.findUnique({
        where: { id },
        select: { startDate: true },
      });
      
      if (existingCamp && existingCamp.startDate >= new Date(endDate)) {
        throw new ConflictException('End date must be after start date');
      }
    }

    return this.prisma.camp.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a camp
   * @param id - ID of the camp to delete
   * @returns The deleted camp
   * @throws NotFoundException if the camp is not found
   */
  async delete(id: string): Promise<Camp> {
    // Verify camp exists
    await this.findById(id);
    
    return this.prisma.camp.delete({
      where: { id },
    });
  }

  /**
   * Check if a camp has any shifts assigned
   * @param id - ID of the camp to check
   * @returns True if the camp has shifts, false otherwise
   */
  async hasShifts(id: string): Promise<boolean> {
    const shiftCount = await this.prisma.shift.count({
      where: { campId: id },
    });
    
    return shiftCount > 0;
  }
}