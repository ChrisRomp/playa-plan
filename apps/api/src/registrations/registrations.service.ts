import { BadRequestException, Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import { CreateRegistrationDto, AddJobToRegistrationDto, CreateCampRegistrationDto, UpdateRegistrationDto } from './dto';
import { Registration, RegistrationStatus } from '@prisma/client';

interface JobRegistrationWithJobs extends Registration {
  jobs?: Array<{
    job?: {
      name?: string;
      category?: {
        name?: string;
      };
      shift?: {
        name?: string;
        startTime?: string;
        endTime?: string;
        dayOfWeek?: string;
      };
      location?: string;
    };
  }>;
}

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new registration for a user for a specific year
   * @param createRegistrationDto - The data to create the registration
   * @returns The created registration
   */
  async create(createRegistrationDto: CreateRegistrationDto): Promise<Registration> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createRegistrationDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${createRegistrationDto.userId} not found`);
    }

    // Check if user already has a registration for this year
    const existingRegistration = await this.prisma.registration.findUnique({
      where: {
        userId_year: {
          userId: createRegistrationDto.userId,
          year: createRegistrationDto.year,
        },
      },
    });

    if (existingRegistration) {
      throw new ConflictException(`User already has a registration for year ${createRegistrationDto.year}`);
    }

    // Validate all jobs exist and have capacity
    const jobs = await Promise.all(
      createRegistrationDto.jobIds.map(async (jobId) => {
        const job = await this.prisma.job.findUnique({
          where: { id: jobId },
          include: { 
            registrations: {
              include: {
                registration: true,
              },
            },
          },
        });

        if (!job) {
          throw new NotFoundException(`Job with ID ${jobId} not found`);
        }

        const currentRegistrationCount = job.registrations.filter(
          r => r.registration.status !== RegistrationStatus.CANCELLED
        ).length;

        return { job, currentRegistrationCount };
      })
    );

    // Determine overall registration status
    const hasWaitlistedJob = jobs.some(
      ({ job, currentRegistrationCount }) => currentRegistrationCount >= job.maxRegistrations
    );
    
    const status = hasWaitlistedJob ? RegistrationStatus.WAITLISTED : RegistrationStatus.PENDING;

    // Create registration with jobs
    return this.prisma.registration.create({
      data: {
        status,
        year: createRegistrationDto.year,
        user: { connect: { id: createRegistrationDto.userId } },
        jobs: {
          create: createRegistrationDto.jobIds.map(jobId => ({
            job: { connect: { id: jobId } },
          })),
        },
      },
      include: {
        user: true,
        jobs: {
          include: {
            job: {
              include: {
                category: true,
                shift: true,
              },
            },
          },
        },
        payments: true,
      },
    });
  }

  /**
   * Add a job to an existing registration
   * @param registrationId - The ID of the registration
   * @param addJobDto - The job to add
   * @returns The updated registration
   */
  async addJobToRegistration(registrationId: string, addJobDto: AddJobToRegistrationDto): Promise<Registration> {
    // Check if registration exists
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        jobs: {
          include: {
            job: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${registrationId} not found`);
    }

    // Check if job exists
    const job = await this.prisma.job.findUnique({
      where: { id: addJobDto.jobId },
      include: { 
        registrations: {
          include: {
            registration: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${addJobDto.jobId} not found`);
    }

    // Check if job is already in this registration
    const existingJobRegistration = registration.jobs.find(
      rj => rj.job.id === addJobDto.jobId
    );

    if (existingJobRegistration) {
      throw new ConflictException('Job is already part of this registration');
    }

    // Add the job to the registration
    await this.prisma.registrationJob.create({
      data: {
        registration: { connect: { id: registrationId } },
        job: { connect: { id: addJobDto.jobId } },
      },
    });

    // Check if this affects the registration status
    const currentRegistrationCount = job.registrations.filter(
      r => r.registration.status !== RegistrationStatus.CANCELLED
    ).length;

    const shouldBeWaitlisted = currentRegistrationCount >= job.maxRegistrations;

    if (shouldBeWaitlisted && registration.status !== RegistrationStatus.WAITLISTED) {
      await this.prisma.registration.update({
        where: { id: registrationId },
        data: { status: RegistrationStatus.WAITLISTED },
      });
    }

    return this.findOne(registrationId);
  }

  /**
   * Remove a job from a registration
   * @param registrationId - The ID of the registration
   * @param jobId - The ID of the job to remove
   * @returns The updated registration
   */
  async removeJobFromRegistration(registrationId: string, jobId: string): Promise<Registration> {
    // Check if registration exists
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${registrationId} not found`);
    }

    // Find and remove the job registration
    const registrationJob = await this.prisma.registrationJob.findFirst({
      where: {
        registrationId,
        jobId,
      },
    });

    if (!registrationJob) {
      throw new NotFoundException('Job not found in this registration');
    }

    await this.prisma.registrationJob.delete({
      where: { id: registrationJob.id },
    });

    return this.findOne(registrationId);
  }

  /**
   * Get all registrations
   * @returns All registrations
   */
  async findAll(): Promise<Registration[]> {
    return this.prisma.registration.findMany({
      include: {
        user: true,
        jobs: {
          include: {
            job: {
              include: {
                category: true,
                shift: true,
              },
            },
          },
        },
        payments: true,
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
        jobs: {
          include: {
            job: {
              include: {
                category: true,
                shift: true,
              },
            },
          },
        },
        payments: true,
      },
      orderBy: {
        year: 'desc',
      },
    });
  }

  /**
   * Get registrations for a specific user and year
   * @param userId - The ID of the user
   * @param year - The year
   * @returns The user's registration for that year, if any
   */
  async findByUserAndYear(userId: string, year: number): Promise<Registration | null> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.registration.findUnique({
      where: {
        userId_year: {
          userId,
          year,
        },
      },
      include: {
        jobs: {
          include: {
            job: {
              include: {
                category: true,
                shift: true,
              },
            },
          },
        },
        payments: true,
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

    const registrationJobs = await this.prisma.registrationJob.findMany({
      where: { jobId },
      include: {
        registration: {
          include: {
            user: true,
            payments: true,
          },
        },
      },
    });

    return registrationJobs.map(rj => rj.registration);
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
        jobs: {
          include: {
            job: {
              include: {
                category: true,
                shift: true,
              },
            },
          },
        },
        payments: true,
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
   * @param updateRegistrationDto - The data to update
   * @returns The updated registration
   */
  async update(id: string, updateRegistrationDto: UpdateRegistrationDto): Promise<Registration> {
    // Check if registration exists
    const existingRegistration = await this.prisma.registration.findUnique({
      where: { id },
    });

    if (!existingRegistration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    return this.prisma.registration.update({
      where: { id },
      data: updateRegistrationDto,
      include: {
        user: true,
        jobs: {
          include: {
            job: {
              include: {
                category: true,
                shift: true,
              },
            },
          },
        },
        payments: true,
      },
    });
  }

  /**
   * Delete a registration
   * @param id - The ID of the registration to delete
   * @returns The deleted registration
   */
  async remove(id: string): Promise<Registration> {
    // Check if registration exists
    const existingRegistration = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        user: true,
        jobs: {
          include: {
            job: {
              include: {
                category: true,
                shift: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!existingRegistration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    // Delete the registration (this will cascade delete RegistrationJobs)
    await this.prisma.registration.delete({
      where: { id },
    });

    return existingRegistration;
  }

  /**
   * Create a comprehensive camp registration
   * @param userId - The ID of the user
   * @param createCampRegistrationDto - The camp registration data
   * @returns The created registrations and camping option registrations
   */
  async createCampRegistration(userId: string, createCampRegistrationDto: CreateCampRegistrationDto) {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Validate that terms have been accepted
      if (!createCampRegistrationDto.acceptedTerms) {
        throw new BadRequestException('Terms and conditions must be accepted');
      }

      // Get current year for job registration
      const currentYear = new Date().getFullYear();

      let jobRegistration = null;
      const campingOptionRegistrations: Array<{
        id: string;
        userId: string;
        campingOptionId: string;
        createdAt: Date;
        updatedAt: Date;
        campingOption: {
          id: string;
          name: string;
          description: string | null;
          enabled: boolean;
          workShiftsRequired: number;
          participantDues: number;
          staffDues: number;
          maxSignups: number;
          createdAt: Date;
          updatedAt: Date;
          fields: Array<{
            id: string;
            displayName: string;
            description: string | null;
            dataType: string;
            required: boolean;
            maxLength: number | null;
            minValue: number | null;
            maxValue: number | null;
            createdAt: Date;
            updatedAt: Date;
            campingOptionId: string;
          }>;
        };
      }> = [];

      // Create job registration if jobs are provided
      if (createCampRegistrationDto.jobs && createCampRegistrationDto.jobs.length > 0) {
        // Check if user already has a registration for this year
        const existingRegistration = await this.prisma.registration.findUnique({
          where: {
            userId_year: {
              userId,
              year: currentYear,
            },
          },
        });

        if (existingRegistration) {
          throw new ConflictException(`User already has a registration for ${currentYear}`);
        }

        // Create the job registration
        jobRegistration = await this.create({
          userId,
          year: currentYear,
          jobIds: createCampRegistrationDto.jobs,
        });
      }

      // Create camping option registrations
      if (createCampRegistrationDto.campingOptions && createCampRegistrationDto.campingOptions.length > 0) {
        for (const campingOptionId of createCampRegistrationDto.campingOptions) {
          // Check if camping option exists
          const campingOption = await this.prisma.campingOption.findUnique({
            where: { id: campingOptionId },
            include: { fields: true },
          });

          if (!campingOption) {
            throw new NotFoundException(`Camping option with ID ${campingOptionId} not found`);
          }

          // Check if user already has this camping option registered
          const existingCampingRegistration = await this.prisma.campingOptionRegistration.findFirst({
            where: {
              userId,
              campingOptionId,
            },
          });

          if (existingCampingRegistration) {
            throw new ConflictException(`User already registered for camping option: ${campingOption.name}`);
          }

          // Create the camping option registration
          const campingRegistration = await this.prisma.campingOptionRegistration.create({
            data: {
              userId,
              campingOptionId,
            },
            include: {
              campingOption: {
                include: { fields: true },
              },
            },
          });

          // Create custom field values if provided
          if (createCampRegistrationDto.customFields && campingOption.fields.length > 0) {
            for (const field of campingOption.fields) {
              const fieldValue = createCampRegistrationDto.customFields[field.id];
              if (fieldValue !== undefined) {
                await this.prisma.campingOptionFieldValue.create({
                  data: {
                    fieldId: field.id,
                    registrationId: campingRegistration.id,
                    value: String(fieldValue),
                  },
                });
              }
            }
          }

          campingOptionRegistrations.push(campingRegistration);
        }
      }

      const result = {
        jobRegistration,
        campingOptionRegistrations,
        message: 'Camp registration completed successfully',
      };

      // Send registration confirmation email (non-blocking)
      this.sendRegistrationConfirmationEmail(user, jobRegistration, campingOptionRegistrations, currentYear)
        .catch(error => {
          this.logger.warn(`Failed to send registration confirmation email to ${user.email}: ${error.message}`);
        });

      return result;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Registration creation failed for user ${userId}: ${err.message}`, err.stack);
      
      // Send registration error email (non-blocking)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      
      if (user) {
        this.sendRegistrationErrorEmail(user.email, err, userId)
          .catch(emailError => {
            this.logger.warn(`Failed to send registration error email to ${user.email}: ${emailError.message}`);
          });
      }
      
      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Send registration confirmation email
   * @param user - User object with email
   * @param jobRegistration - Job registration details
   * @param campingOptionRegistrations - Camping option registrations
   * @param year - Registration year
   */
  private async sendRegistrationConfirmationEmail(
    user: { email: string },
    jobRegistration: Registration | null,
    campingOptionRegistrations: Array<{
      id: string;
      userId: string;
      campingOptionId: string;
      createdAt: Date;
      updatedAt: Date;
      campingOption: {
        id: string;
        name: string;
        description: string | null;
        enabled: boolean;
        workShiftsRequired: number;
        participantDues: number;
        staffDues: number;
        maxSignups: number;
        createdAt: Date;
        updatedAt: Date;
        fields: Array<{
          id: string;
          displayName: string;
          description: string | null;
          dataType: string;
          required: boolean;
          maxLength: number | null;
          minValue: number | null;
          maxValue: number | null;
          createdAt: Date;
          updatedAt: Date;
          campingOptionId: string;
        }>;
      };
    }>,
    year: number
  ): Promise<void> {
    try {
      // Calculate total cost from camping options
      const totalCost = campingOptionRegistrations.reduce((total, reg) => {
        return total + (reg.campingOption?.participantDues || 0);
      }, 0);

      // Format camping options
      const campingOptions = campingOptionRegistrations.map(reg => ({
        name: reg.campingOption?.name || 'Unknown',
        description: reg.campingOption?.description || undefined,
      }));

      // Format jobs from job registration - safely handle potential undefined jobs
      const jobs = jobRegistration && 'jobs' in jobRegistration && Array.isArray((jobRegistration as JobRegistrationWithJobs).jobs)
        ? (jobRegistration as JobRegistrationWithJobs).jobs?.map((regJob) => ({
          name: regJob.job?.name || 'Unknown Job',
          category: regJob.job?.category?.name || 'Unknown Category',
          shift: {
            name: regJob.job?.shift?.name || 'Unknown Shift',
            startTime: regJob.job?.shift?.startTime || '',
            endTime: regJob.job?.shift?.endTime || '',
            dayOfWeek: regJob.job?.shift?.dayOfWeek || '',
          },
          location: regJob.job?.location || 'TBD',
        })) || []
        : [];

      const registrationDetails = {
        id: jobRegistration?.id || 'pending',
        year,
        status: jobRegistration?.status || 'PENDING',
        campingOptions,
        jobs,
        totalCost: totalCost > 0 ? totalCost * 100 : undefined, // Convert to cents
        currency: 'USD',
      };

      await this.notificationsService.sendRegistrationConfirmationEmail(
        user.email,
        registrationDetails,
        jobRegistration?.userId || ''
      );

      this.logger.log(`Registration confirmation email sent to ${user.email}`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Error sending registration confirmation email: ${err.message}`, err.stack);
      // Don't throw - email failures should not block registration
    }
  }

  /**
   * Send registration error email
   * @param email - User email
   * @param error - The error that occurred
   * @param userId - User ID for audit trail
   */
  private async sendRegistrationErrorEmail(email: string, error: Error, userId: string): Promise<void> {
    try {
      const errorDetails = {
        error: error.constructor.name,
        message: error.message,
        suggestions: this.getRegistrationErrorSuggestions(error),
      };

      await this.notificationsService.sendRegistrationErrorEmail(email, errorDetails, userId);
      this.logger.log(`Registration error email sent to ${email}`);
    } catch (emailError: unknown) {
      const err = emailError as Error;
      this.logger.error(`Error sending registration error email: ${err.message}`, err.stack);
      // Don't throw - email failures should not block error handling
    }
  }

  /**
   * Get helpful suggestions based on the type of error
   * @param error - The error that occurred
   * @returns Array of suggestion strings
   */
  private getRegistrationErrorSuggestions(error: Error): string[] {
    if (error instanceof ConflictException) {
      return [
        'Check if you already have a registration for this year',
        'Review your camping option selections for duplicates',
        'Contact support if you believe this is an error',
      ];
    }
    
    if (error instanceof NotFoundException) {
      return [
        'Verify that all selected options are still available',
        'Refresh the page and try again',
        'Contact support if options should be available',
      ];
    }
    
    if (error instanceof BadRequestException) {
      return [
        'Ensure you have accepted the terms and conditions',
        'Check that all required fields are filled out',
        'Verify your selections are valid',
      ];
    }
    
    return [
      'Try again in a few minutes',
      'Clear your browser cache and reload the page',
      'Contact support if the problem persists',
    ];
  }

  /**
   * Get user's camp registration
   * @param userId - The ID of the user
   * @returns The user's camping option registrations and custom field values
   */
  async getMyCampRegistration(userId: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get camping option registrations for the user
    const campingOptionRegistrations = await this.prisma.campingOptionRegistration.findMany({
      where: { userId },
      include: {
        campingOption: {
          include: {
            fields: true,
          },
        },
        fieldValues: {
          include: {
            field: true,
          },
        },
      },
    });

    // Get user's job registrations (all years)
    const jobRegistrations = await this.prisma.registration.findMany({
      where: { userId },
      include: {
        jobs: {
          include: {
            job: {
              include: {
                category: true,
                shift: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    // Flatten custom field values from all camping option registrations
    const customFieldValues = campingOptionRegistrations.flatMap(reg => 
      reg.fieldValues.map(fv => ({
        id: fv.id,
        value: fv.value,
        fieldId: fv.fieldId,
        registrationId: fv.registrationId,
        field: fv.field,
      }))
    );

    return {
      campingOptions: campingOptionRegistrations,
      customFieldValues,
      jobRegistrations,
      hasRegistration: campingOptionRegistrations.length > 0 || jobRegistrations.length > 0,
    };
  }
}
