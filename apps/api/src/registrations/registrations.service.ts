import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRegistrationDto, CreateCampRegistrationDto, UpdateRegistrationDto } from './dto';
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

  /**
   * Create a comprehensive camp registration including camping options, custom fields, and job registrations
   * @param userId - The ID of the user making the registration
   * @param createCampRegistrationDto - The comprehensive registration data
   * @returns The created registrations and related data
   */
  async createCampRegistration(userId: string, createCampRegistrationDto: CreateCampRegistrationDto) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verify all camping options exist
    const campingOptions = await this.prisma.campingOption.findMany({
      where: { id: { in: createCampRegistrationDto.campingOptions } },
    });

    if (campingOptions.length !== createCampRegistrationDto.campingOptions.length) {
      throw new BadRequestException('One or more camping options not found');
    }

    // Verify all jobs exist
    const jobs = await this.prisma.job.findMany({
      where: { id: { in: createCampRegistrationDto.jobs } },
      include: { registrations: true },
    });

    if (jobs.length !== createCampRegistrationDto.jobs.length) {
      throw new BadRequestException('One or more jobs not found');
    }

    // Check if user already has any registration for the current year
    // Since the system is designed for one registration year at a time, 
    // any existing registration means they're already registered
    const existingCampingRegistrations = await this.prisma.campingOptionRegistration.findMany({
      where: { userId },
    });

    const existingJobRegistrations = await this.prisma.registration.findMany({
      where: {
        userId,
        status: { notIn: [RegistrationStatus.CANCELLED] },
      },
    });

    if (existingCampingRegistrations.length > 0 || existingJobRegistrations.length > 0) {
      throw new BadRequestException('User is already registered for this year. Only one registration per year is allowed.');
    }

    // Use a transaction to ensure all operations succeed or fail together
    const result = await this.prisma.$transaction(async (prisma) => {
      // Create camping option registrations
      const campingOptionRegistrations = await Promise.all(
        createCampRegistrationDto.campingOptions.map(campingOptionId =>
          prisma.campingOptionRegistration.create({
            data: {
              userId,
              campingOptionId,
            },
            include: {
              campingOption: true,
            },
          })
        )
      );

             // Create custom field values if provided
       let customFieldValues: { id: string; value: string; fieldId: string; registrationId: string }[] = [];
       if (createCampRegistrationDto.customFields) {
         // We need to associate field values with the correct camping option registration
         // For simplicity, we'll associate each field with the first camping option registration
         // In a more complex scenario, you might need to determine which field belongs to which camping option
         const primaryRegistrationId = campingOptionRegistrations[0]?.id;
         
         if (primaryRegistrationId) {
           customFieldValues = await Promise.all(
             Object.entries(createCampRegistrationDto.customFields).map(([fieldId, value]) =>
               prisma.campingOptionFieldValue.create({
                 data: {
                   registrationId: primaryRegistrationId,
                   fieldId,
                   value: typeof value === 'string' ? value : JSON.stringify(value),
                 },
                 include: {
                   field: true,
                 },
               })
             )
           );
         }
       }

      // Create job registrations
      const jobRegistrations = await Promise.all(
        createCampRegistrationDto.jobs.map(jobId => {
          const job = jobs.find(j => j.id === jobId)!;
          const currentRegistrations = job.registrations.filter(
            r => r.status !== RegistrationStatus.CANCELLED
          ).length;
          
          const status = currentRegistrations >= job.maxRegistrations
            ? RegistrationStatus.WAITLISTED
            : RegistrationStatus.PENDING;

          return prisma.registration.create({
            data: {
              userId,
              jobId,
              status,
            },
            include: {
              job: {
                include: {
                  category: true,
                  shift: true,
                },
              },
            },
          });
        })
      );

      return {
        campingOptionRegistrations,
        customFieldValues,
        jobRegistrations,
        acceptedTerms: createCampRegistrationDto.acceptedTerms,
      };
    });

    return result;
  }

  /**
   * Get the current user's complete camp registration
   * @param userId - The ID of the user
   * @returns The user's complete camp registration data
   */
  async getMyCampRegistration(userId: string) {
    // Get camping option registrations for the user
    const campingOptionRegistrations = await this.prisma.campingOptionRegistration.findMany({
      where: { userId },
      include: {
        campingOption: {
          include: {
            fields: true,
          },
        },
      },
    });

    // Get custom field values for the user
    const customFieldValues = await this.prisma.campingOptionFieldValue.findMany({
      where: { 
        registration: {
          userId
        }
      },
      include: {
        field: true,
      },
    });

    // Get job registrations for the user
    const jobRegistrations = await this.prisma.registration.findMany({
      where: { userId },
      include: {
        job: {
          include: {
            category: true,
            shift: true,
          },
        },
        payment: true,
      },
    });

    return {
      campingOptions: campingOptionRegistrations,
      customFieldValues,
      jobRegistrations,
      hasRegistration: campingOptionRegistrations.length > 0 || jobRegistrations.length > 0,
    };
  }
}
