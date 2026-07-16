import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CoreConfigService } from '../core-config/services/core-config.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job, Prisma, UserRole } from '@prisma/client';
import { isCapacityReservingStatus } from '../registrations/constants/registration-status.constants';

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
  constructor(
    private prisma: PrismaService,
    private coreConfigService: CoreConfigService,
  ) {}

  async create(createJobDto: CreateJobDto) {
    const config = await this.coreConfigService.findCurrent();
    const job = await this.prisma.job.create({
      data: {
        name: createJobDto.name,
        location: createJobDto.location,
        maxRegistrations: createJobDto.maxRegistrations || 10, // Default to 10 if not provided
        active: createJobDto.active ?? true,
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
    return this.addDerivedPropertiesWithRegistrations(job, config.registrationYear);
  }

  /**
   * Get all jobs, optionally filtered by user role.
   * Participants will not see staff-only jobs.
   * @param userRole - Optional role to filter results
   */
  async findAll(userRole?: UserRole, includeInactive = false) {
    const config = await this.coreConfigService.findCurrent();
    const canIncludeInactive = userRole === UserRole.ADMIN && includeInactive;
    const jobs = await this.prisma.job.findMany({
      where: {
        ...(!canIncludeInactive && { active: true }),
        ...(userRole === UserRole.PARTICIPANT && { category: { staffOnly: false } }),
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

    return jobs.map(job => this.addDerivedPropertiesWithRegistrations(job, config.registrationYear));
  }

  async findOne(id: string) {
    const config = await this.coreConfigService.findCurrent();
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
    return this.addDerivedPropertiesWithRegistrations(job, config.registrationYear);
  }

  async update(id: string, updateJobDto: UpdateJobDto) {
    const config = await this.coreConfigService.findCurrent();
    try {
      // Create update data object with proper typing
      const updateData: Prisma.JobUpdateInput = {};
      
      if (updateJobDto.name) updateData.name = updateJobDto.name;
      if (updateJobDto.location) updateData.location = updateJobDto.location;
      if (updateJobDto.maxRegistrations) updateData.maxRegistrations = updateJobDto.maxRegistrations;
      if (updateJobDto.active !== undefined) updateData.active = updateJobDto.active;
      
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
      return this.addDerivedPropertiesWithRegistrations(job, config.registrationYear);
    } catch {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    const historicalRegistrationCount = await this.prisma.registrationJob.count({
      where: { jobId: id },
    });
    if (historicalRegistrationCount > 0) {
      throw this.createHistoricalRegistrationError(id);
    }

    try {
      const config = await this.coreConfigService.findCurrent();
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
      return this.addDerivedPropertiesWithRegistrations(job, config.registrationYear);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw this.createHistoricalRegistrationError(id);
        }
        if (error.code === 'P2025') {
          throw new NotFoundException(`Job with ID ${id} not found`);
        }
      }
      throw error;
    }
  }

  private createHistoricalRegistrationError(id: string): BadRequestException {
    return new BadRequestException(
      `Cannot delete job with ID ${id} because it has historical registrations. Deactivate it instead.`,
    );
  }

  /**
   * Add derived properties from category and calculate current registrations for a job
   */
  private addDerivedPropertiesWithRegistrations(job: JobWithRelations, registrationYear: number) {
    // Count only capacity-reserving registrations (PENDING, CONFIRMED, WAITLISTED)
    // for the configured registration year
    const currentRegistrations = job.registrations?.filter(
      reg => isCapacityReservingStatus(reg.registration.status) && reg.registration.year === registrationYear
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