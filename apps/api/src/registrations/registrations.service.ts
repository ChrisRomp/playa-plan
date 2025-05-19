import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRegistrationDto, UpdateRegistrationDto } from './dto';
import { Registration, RegistrationStatus } from '@prisma/client';

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new registration
   * @param createRegistrationDto - The data to create the registration
   * @returns The created registration
   */
  async create(createRegistrationDto: CreateRegistrationDto): Promise<Registration> {
    // Check if job exists and has capacity
    const job = await this.prisma.job.findUnique({
      where: { id: createRegistrationDto.jobId },
      include: { 
        shift: true,
        registrations: true 
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${createRegistrationDto.jobId} not found`);
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createRegistrationDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${createRegistrationDto.userId} not found`);
    }

    // Check if user already registered for this job
    const existingRegistration = await this.prisma.registration.findFirst({
      where: {
        userId: createRegistrationDto.userId,
        jobId: createRegistrationDto.jobId,
        status: { notIn: [RegistrationStatus.CANCELLED] },
      },
    });

    if (existingRegistration) {
      throw new BadRequestException('User already registered for this job');
    }

    // Determine registration status based on capacity
    const status = job.registrations.filter(
      r => r.status !== RegistrationStatus.CANCELLED
    ).length >= job.maxRegistrations
      ? RegistrationStatus.WAITLISTED
      : RegistrationStatus.PENDING;

    // Create registration data object
    const data: {
      status: RegistrationStatus;
      user: { connect: { id: string } };
      job: { connect: { id: string } };
      payment?: { connect: { id: string } };
    } = {
      status,
      user: { connect: { id: createRegistrationDto.userId } },
      job: { connect: { id: createRegistrationDto.jobId } },
    };

    // Add payment if provided
    if (createRegistrationDto.paymentId) {
      // Check if payment exists
      const payment = await this.prisma.payment.findUnique({
        where: { id: createRegistrationDto.paymentId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${createRegistrationDto.paymentId} not found`);
      }

      data.payment = { connect: { id: createRegistrationDto.paymentId } };
    }

    return this.prisma.registration.create({
      data,
      include: {
        user: true,
        job: {
          include: {
            category: true,
            shift: {
              include: {
                // camp references removed
              },
            },
          },
        },
        payment: true,
      },
    });
  }

  /**
   * Get all registrations
   * @returns All registrations
   */
  async findAll(): Promise<Registration[]> {
    return this.prisma.registration.findMany({
      include: {
        user: true,
        job: {
          include: {
            category: true,
            shift: {
              include: {
                // camp references removed
              },
            },
          },
        },
        payment: true,
      },
    });
  }

  /**
   * Get registrations for a specific user
   * @param userId - The ID of the user
   * @returns The user's registrations
   */
  async findByUser(userId: string): Promise<Registration[]> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.registration.findMany({
      where: { userId },
      include: {
        job: {
          include: {
            category: true,
            shift: {
              include: {
                // camp references removed
              },
            },
          },
        },
        payment: true,
      },
    });
  }

  /**
   * Get registrations for a specific job
   * @param jobId - The ID of the job
   * @returns The job's registrations
   */
  async findByJob(jobId: string): Promise<Registration[]> {
    // Check if job exists
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return this.prisma.registration.findMany({
      where: { jobId },
      include: {
        user: true,
        payment: true,
      },
    });
  }

  /**
   * Get a registration by ID
   * @param id - The ID of the registration to find
   * @returns The registration, if found
   * @throws NotFoundException if not found
   */
  async findOne(id: string): Promise<Registration> {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        user: true,
        job: {
          include: {
            category: true,
            shift: {
              include: {
                // camp references removed
              },
            },
          },
        },
        payment: true,
      },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    return registration;
  }

  /**
   * Update a registration
   * @param id - The ID of the registration to update
   * @param updateRegistrationDto - The data to update the registration with
   * @returns The updated registration
   * @throws NotFoundException if not found
   */
  async update(id: string, updateRegistrationDto: UpdateRegistrationDto): Promise<Registration> {
    // Check if registration exists
    await this.findOne(id);

    const data: {
      status?: RegistrationStatus;
      job?: { connect: { id: string } };
      payment?: { connect: { id: string } };
      [key: string]: unknown | { connect: { id: string } } | undefined;
    } = { ...updateRegistrationDto };
    
    // Handle relations
    if (updateRegistrationDto.jobId) {
      // Check if job exists
      const job = await this.prisma.job.findUnique({
        where: { id: updateRegistrationDto.jobId },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${updateRegistrationDto.jobId} not found`);
      }

      data.job = { connect: { id: updateRegistrationDto.jobId } };
      delete data.jobId;
    }
    
    if (updateRegistrationDto.paymentId) {
      // Check if payment exists
      const payment = await this.prisma.payment.findUnique({
        where: { id: updateRegistrationDto.paymentId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${updateRegistrationDto.paymentId} not found`);
      }

      data.payment = { connect: { id: updateRegistrationDto.paymentId } };
      delete data.paymentId;
    }

    return this.prisma.registration.update({
      where: { id },
      data,
      include: {
        user: true,
        job: {
          include: {
            category: true,
            shift: {
              include: {
                // camp references removed
              },
            },
          },
        },
        payment: true,
      },
    });
  }

  /**
   * Remove a registration
   * @param id - The ID of the registration to remove
   * @returns The removed registration
   * @throws NotFoundException if not found
   */
  async remove(id: string): Promise<Registration> {
    // Check if registration exists
    await this.findOne(id);

    return this.prisma.registration.delete({
      where: { id },
      include: {
        user: true,
        job: {
          include: {
            category: true,
            shift: true,
          },
        },
        payment: true,
      },
    });
  }
}
