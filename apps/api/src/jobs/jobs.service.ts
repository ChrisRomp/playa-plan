import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job, Prisma } from '@prisma/client';

/**
 * Type definition for job with included relations
 */
type JobWithRelations = Job & {
  category?: {
    id: string;
    name: string;
    description: string | null;
    staffOnly: boolean;
    alwaysRequired: boolean;
  } | null;
  shift?: {
    id: string;
    name: string;
    description: string | null;
    startTime: string;
    endTime: string;
    dayOfWeek: string;
  } | null;
  registrations?: Array<{
    id: string;
    registrationId: string;
    jobId: string;
    createdAt: Date;
    registration: {
      id: string;
      status: string;
      year: number;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
    };
  }>;
};

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async create(createJobDto: CreateJobDto) {
    const job = await this.prisma.job.create({
      data: {
        name: createJobDto.name,
        location: createJobDto.location,
        maxRegistrations: createJobDto.maxRegistrations || 10, // Default to 10 if not provided
        category: {
          connect: { id: createJobDto.categoryId }
        },
        shift: {
          connect: { id: createJobDto.shiftId }
        }
      },
      include: {
        category: true,
        shift: true,
        registrations: {
          include: {
            registration: true,
          },
        },
      },
    });

    // Add derived properties from category and calculate current registrations
    return this.addDerivedPropertiesWithRegistrations(job);
  }

  async findAll() {
    const jobs = await this.prisma.job.findMany({
      include: {
        category: true,
        shift: true,
        registrations: {
          include: {
            registration: true,
          },
        },
      },
    });

    // Add derived properties from categories and calculate current registrations
    return jobs.map(job => this.addDerivedPropertiesWithRegistrations(job));
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        category: true,
        shift: true,
        registrations: {
          include: {
            registration: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    // Add derived properties from category and calculate current registrations
    return this.addDerivedPropertiesWithRegistrations(job);
  }

  async update(id: string, updateJobDto: UpdateJobDto) {
    try {
      // Create update data object with proper typing
      const updateData: Prisma.JobUpdateInput = {};
      
      if (updateJobDto.name) updateData.name = updateJobDto.name;
      if (updateJobDto.location) updateData.location = updateJobDto.location;
      if (updateJobDto.maxRegistrations) updateData.maxRegistrations = updateJobDto.maxRegistrations;
      
      if (updateJobDto.categoryId) {
        updateData.category = { connect: { id: updateJobDto.categoryId } };
      }
      
      if (updateJobDto.shiftId) {
        updateData.shift = { connect: { id: updateJobDto.shiftId } };
      }
      
      const job = await this.prisma.job.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          shift: true,
          registrations: {
            include: {
              registration: true,
            },
          },
        },
      });

      // Add derived properties from category and calculate current registrations
      return this.addDerivedPropertiesWithRegistrations(job);
    } catch {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      const job = await this.prisma.job.delete({
        where: { id },
        include: {
          category: true,
          shift: true,
          registrations: {
            include: {
              registration: true,
            },
          },
        },
      });

      // Add derived properties from category and calculate current registrations
      return this.addDerivedPropertiesWithRegistrations(job);
    } catch {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
  }

  /**
   * Add derived properties from category and calculate current registrations for a job
   */
  private addDerivedPropertiesWithRegistrations(job: JobWithRelations) {
    // Get current year
    const currentYear = new Date().getFullYear();
    
    // Count all non-cancelled registrations for the current year
    // This includes PENDING, CONFIRMED, and WAITLISTED registrations
    const currentRegistrations = job.registrations?.filter(
      reg => reg.registration.status !== 'CANCELLED' && reg.registration.year === currentYear
    ).length || 0;

    // Exclude registrations from the returned object
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { registrations, ...jobWithoutRegistrations } = job;

    return {
      ...jobWithoutRegistrations,
      staffOnly: job.category?.staffOnly || false,
      alwaysRequired: job.category?.alwaysRequired || false,
      currentRegistrations,
    };
  }
} 