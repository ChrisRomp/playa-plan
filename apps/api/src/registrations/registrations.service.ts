import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import { CreateRegistrationDto, AddJobToRegistrationDto, CreateCampRegistrationDto, UpdateRegistrationDto } from './dto';
import { Registration, RegistrationStatus, UserRole } from '@prisma/client';
import { DayOfWeek } from '../common/enums/day-of-week.enum';
import { RegistrationPolicyService } from './services/registration-policy.service';

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
    private readonly policyService: RegistrationPolicyService,
  ) {}

  /**
   * Create a new registration for a user for a specific year.
   *
   * Used by the admin/staff `POST /registrations` endpoint and the
   * single-job participant `POST /jobs/:id/register` endpoint. Sets
   * status to `WAITLISTED` when any chosen job is over capacity, else
   * `PENDING`. The deferred-payment branch lives entirely in
   * `createCampRegistration` and is intentionally not exposed here —
   * deferral is a participant choice tied to the policy gate, not a
   * standalone admin operation.
   *
   * @param createRegistrationDto - The data to create the registration
   * @returns The created registration
   */
  async create(
    createRegistrationDto: CreateRegistrationDto,
  ): Promise<Registration> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createRegistrationDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${createRegistrationDto.userId} not found`);
    }

    // Block participants from registering for staff-only jobs
    await this.validateNoStaffOnlyJobsForParticipant(user.role, createRegistrationDto.jobIds);

    // Check if user already has an active registration for this year
    const existingActiveRegistration = await this.prisma.registration.findFirst({
      where: {
        userId: createRegistrationDto.userId,
        year: createRegistrationDto.year,
        status: { notIn: [RegistrationStatus.CANCELLED] }
      },
    });

    if (existingActiveRegistration) {
      throw new ConflictException(`User already has an active registration for year ${createRegistrationDto.year}`);
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

    // Determine overall registration status. WAITLISTED wins when any
    // chosen job is over capacity; otherwise PENDING (awaiting payment).
    // The deferred-payment CONFIRMED branch is exclusive to
    // `createCampRegistration` and lives in its own transactional write
    // path — `create()` does not surface it.
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
        user: {
          select: { id: true, role: true },
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

    // Block participants from adding staff-only jobs
    if (!registration.user) {
      throw new NotFoundException(`User for registration ${registration.id} not found`);
    }
    await this.validateNoStaffOnlyJobsForParticipant(registration.user.role, [addJobDto.jobId]);

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
   * Get registration for a specific user and year
   * @param userId - The ID of the user
   * @param year - The year
   * @param excludeCancelled - Whether to exclude cancelled registrations (default: false)
   * @returns The user's registration for that year, if any
   */
  async findByUserAndYear(userId: string, year: number, excludeCancelled = false): Promise<Registration | null> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const whereCondition: {
      userId: string;
      year: number;
      status?: { notIn: RegistrationStatus[] };
    } = {
      userId,
      year,
    };

    if (excludeCancelled) {
      whereCondition.status = { notIn: [RegistrationStatus.CANCELLED] };
    }

    return this.prisma.registration.findFirst({
      where: whereCondition,
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
        createdAt: 'desc', // Get the most recent registration if multiple exist
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

    const updatedRegistration = await this.prisma.registration.update({
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

    // Send confirmation email if status changed to CONFIRMED
    if (existingRegistration.status !== 'CONFIRMED' && updatedRegistration.status === 'CONFIRMED') {
      this.sendRegistrationConfirmationEmailForUpdatedStatus(updatedRegistration)
        .catch(error => {
          this.logger.warn(`Failed to send registration confirmation email for updated status: ${error.message}`);
        });
    }

    return updatedRegistration;
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
   *
   * Runs the participant-side policy gates (`RegistrationPolicyService`)
   * BEFORE entering the broad try/catch that emits a registration-error
   * email, so policy 4xx rejections (`closed window`, `not eligible`,
   * `must pick a job`, `not eligible to defer`) propagate cleanly and do
   * NOT trigger an "unexpected error" email. The broad try/catch only wraps
   * the create-database-rows section where any failure really is unexpected
   * and worth notifying the user about.
   *
   * Always creates a `Registration` row when policy passes, even when the
   * user has chosen no jobs (relies on `user.allowNoJob` for eligibility,
   * checked by the policy service). This is a change from the previous
   * behavior, which silently created no `Registration` at all for a
   * camping-only signup — leaving nowhere to track payment or surface the
   * signup on the dashboard.
   *
   * @param userId - The ID of the user
   * @param createCampRegistrationDto - The camp registration data
   * @returns The created registrations and camping option registrations
   */
  async createCampRegistration(userId: string, createCampRegistrationDto: CreateCampRegistrationDto) {
    // Load user once so the policy gate and downstream queries share it.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Policy gates run OUTSIDE the broad try/catch — a 4xx from these is
    // an expected rejection, not an "unexpected registration error".
    await this.policyService.assertCanCreateCampRegistration(user, {
      jobs: createCampRegistrationDto.jobs ?? [],
      deferPayment: createCampRegistrationDto.deferPayment ?? false,
    });

    // Validate that terms have been accepted. Kept outside the broad
    // try/catch for the same reason — terms-missing is a user-correctable
    // input error, not an "unexpected" failure.
    if (!createCampRegistrationDto.acceptedTerms) {
      throw new BadRequestException('Terms and conditions must be accepted');
    }

    // Pre-flight: active-registration conflict and camping-option existence
    // checks. These are expected 4xx rejections and stay outside the
    // broad try/catch that emits the registration-error email.
    const currentYear = new Date().getFullYear();
    const existingActiveRegistration = await this.prisma.registration.findFirst({
      where: {
        userId,
        year: currentYear,
        status: { notIn: [RegistrationStatus.CANCELLED] },
      },
    });
    if (existingActiveRegistration) {
      throw new ConflictException(`User already has an active registration for ${currentYear}`);
    }

    const campingOptionIds = createCampRegistrationDto.campingOptions ?? [];
    // Validate every camping option up front: must exist and the user must
    // not already be registered for it. This catches a stale option id or
    // a duplicate signup before any writes happen, avoiding the
    // half-created-registration trap.
    const validatedCampingOptions: Array<{
      campingOptionId: string;
      fields: Array<{ id: string }>;
      name: string;
    }> = [];
    for (const campingOptionId of campingOptionIds) {
      const campingOption = await this.prisma.campingOption.findUnique({
        where: { id: campingOptionId },
        include: { fields: true },
      });
      if (!campingOption) {
        throw new NotFoundException(`Camping option with ID ${campingOptionId} not found`);
      }
      const existingCampingRegistration =
        await this.prisma.campingOptionRegistration.findFirst({
          where: { userId, campingOptionId },
        });
      if (existingCampingRegistration) {
        throw new ConflictException(
          `User already registered for camping option: ${campingOption.name}`,
        );
      }
      validatedCampingOptions.push({
        campingOptionId,
        fields: campingOption.fields,
        name: campingOption.name,
      });
    }

    // Job validation reads. Done outside the transaction (reads can race
    // with concurrent writers — that's a pre-existing limitation we
    // accept) and used both to determine WAITLISTED status and to block
    // participants from grabbing staff-only jobs.
    const jobIds = createCampRegistrationDto.jobs ?? [];
    await this.validateNoStaffOnlyJobsForParticipant(user.role, jobIds);

    const jobsWithCounts = await Promise.all(
      jobIds.map(async (jobId) => {
        const job = await this.prisma.job.findUnique({
          where: { id: jobId },
          include: {
            registrations: { include: { registration: true } },
          },
        });
        if (!job) {
          throw new NotFoundException(`Job with ID ${jobId} not found`);
        }
        const currentRegistrationCount = job.registrations.filter(
          (r) => r.registration.status !== RegistrationStatus.CANCELLED,
        ).length;
        return { job, currentRegistrationCount };
      }),
    );

    const deferPayment = createCampRegistrationDto.deferPayment ?? false;
    // hasWaitlistedJob: under normal UI flow this is unreachable — the
    // RegistrationPage disables full-job checkboxes
    // (RegistrationPage.tsx:1017) so a participant cannot select an
    // over-capacity job. Kept as defense-in-depth for two paths the
    // UI does not guard: (a) a direct API call from a malicious or
    // out-of-date client, and (b) a TOCTOU race where two participants
    // load the form with a job at N-1 of N spots taken and both submit.
    // The check costs one extra prisma read per job and keeps capacity
    // enforced server-side, consistent with what
    // `RegistrationsService.create()` (used by admin/staff and
    // `POST /jobs/:id/register`) already does.
    const hasWaitlistedJob = jobsWithCounts.some(
      ({ job, currentRegistrationCount }) =>
        currentRegistrationCount >= job.maxRegistrations,
    );

    // Status semantics (Option A from issue #160 design):
    //   - WAITLISTED wins when any chosen job is over capacity, even for
    //     deferred registrations (capacity > deferral preference). Payment
    //     must not buy a slot the user can't have; see also the matching
    //     guard in `payments.service.ts` `verifyStripeSession` and
    //     `markRegistrationPaid` which refuse to promote WAITLISTED →
    //     CONFIRMED on payment.
    //   - Otherwise: deferred registrations land CONFIRMED (no payment is
    //     expected up front); non-deferred land PENDING (awaiting payment).
    let status: RegistrationStatus;
    if (hasWaitlistedJob) {
      status = RegistrationStatus.WAITLISTED;
    } else if (deferPayment) {
      status = RegistrationStatus.CONFIRMED;
    } else {
      status = RegistrationStatus.PENDING;
    }

    try {
      // Atomic write of Registration + RegistrationJobs + CampingOptionRegistrations
      // + CampingOptionFieldValues. Wrapping in $transaction guarantees that
      // a downstream failure (e.g., the 3rd camping option fails to insert)
      // rolls back ALL earlier writes — including the Registration and any
      // CampingOptionRegistrations that already succeeded. Without this,
      // CampingOptionRegistration has no FK to Registration so deleting the
      // Registration in a manual catch leaves orphaned rows behind that
      // block retries with "already registered for camping option X".
      const { jobRegistration, campingOptionRegistrations } =
        await this.prisma.$transaction(async (tx) => {
          const jobRegistration = await tx.registration.create({
            data: {
              status,
              paymentDeferred: deferPayment,
              year: currentYear,
              user: { connect: { id: userId } },
              jobs: {
                create: jobIds.map((jobId) => ({
                  job: { connect: { id: jobId } },
                })),
              },
            },
            include: {
              user: true,
              jobs: {
                include: {
                  job: { include: { category: true, shift: true } },
                },
              },
              payments: true,
            },
          });

          const created: Array<{
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

          for (const opt of validatedCampingOptions) {
            const campingRegistration =
              await tx.campingOptionRegistration.create({
                data: { userId, campingOptionId: opt.campingOptionId },
                include: { campingOption: { include: { fields: true } } },
              });

            if (createCampRegistrationDto.customFields && opt.fields.length > 0) {
              for (const field of opt.fields) {
                const fieldValue =
                  createCampRegistrationDto.customFields[field.id];
                if (fieldValue !== undefined) {
                  await tx.campingOptionFieldValue.create({
                    data: {
                      fieldId: field.id,
                      registrationId: campingRegistration.id,
                      value: String(fieldValue),
                    },
                  });
                }
              }
            }

            created.push(campingRegistration);
          }

          return { jobRegistration, campingOptionRegistrations: created };
        });

      const result = {
        jobRegistration,
        campingOptionRegistrations,
        message: 'Camp registration completed successfully',
      };

      // Send registration confirmation email immediately when the
      // registration lands CONFIRMED (which today happens only when
      // paymentDeferred=true and no chosen job was waitlisted). For
      // non-deferred PENDING registrations the email is still sent by the
      // payments webhook on completed payment.
      //
      // For deferred WAITLISTED registrations we skip auto-email. This
      // state is unreachable via the normal UI flow (RegistrationPage
      // disables full-job checkboxes), but a direct API call or a TOCTOU
      // race could produce it. If it does, "Registration Confirmation"
      // copy would mislead a waitlisted participant into thinking they
      // have a slot; the standard waitlist flow (admin-driven via
      // RegistrationAdminService) is responsible for their communication.
      if (
        jobRegistration.paymentDeferred &&
        jobRegistration.status === RegistrationStatus.CONFIRMED
      ) {
        // Best-effort: log and swallow failures so a transient email
        // outage never blocks the registration response.
        this.sendRegistrationConfirmationEmail(
          {
            email: user.email,
            firstName: user.firstName ?? undefined,
            lastName: user.lastName ?? undefined,
            playaName: user.playaName,
          },
          jobRegistration,
          campingOptionRegistrations,
          currentYear,
          { paymentDeferred: true },
        ).catch((emailErr) => {
          const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
          this.logger.warn(
            `Failed to send deferred-registration confirmation email to ${user.email}: ${message}`,
          );
        });
      }

      return result;
    } catch (error: unknown) {
      // Known HTTP exceptions (e.g., ForbiddenException for blocked users,
      // NotFoundException, BadRequestException, ConflictException) represent
      // expected client-facing errors, not system failures. Re-throw them
      // directly without logging an error or sending a registration error
      // email to the user.
      if (error instanceof HttpException) {
        throw error;
      }

      const err = error as Error;
      this.logger.error(`Registration creation failed for user ${userId}: ${err.message}`, err.stack);

      // The transaction above rolls back all writes on failure, so there
      // is no half-created Registration or CampingOptionRegistration to
      // clean up here. The catch only logs and emails the user.

      // Send registration error email (non-blocking). Only fires for
      // unexpected failures inside the transaction — policy/terms/conflict
      // 4xx rejections short-circuited above and never reach this catch.
      this.sendRegistrationErrorEmail(user.email, err, userId)
        .catch(emailError => {
          this.logger.warn(`Failed to send registration error email to ${user.email}: ${emailError.message}`);
        });

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Send registration confirmation email
   * @param user - User object with email and name fields
   * @param jobRegistration - Job registration details
   * @param campingOptionRegistrations - Camping option registrations
   * @param year - Registration year
   */
  private async sendRegistrationConfirmationEmail(
    user: { email: string; firstName?: string; lastName?: string; playaName?: string | null },
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
    year: number,
    options: { paymentDeferred?: boolean } = {},
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
      const dayOfWeekOrder = {
        [DayOfWeek.PRE_OPENING]: 0,
        [DayOfWeek.OPENING_SUNDAY]: 1,
        [DayOfWeek.MONDAY]: 2,
        [DayOfWeek.TUESDAY]: 3,
        [DayOfWeek.WEDNESDAY]: 4,
        [DayOfWeek.THURSDAY]: 5,
        [DayOfWeek.FRIDAY]: 6,
        [DayOfWeek.SATURDAY]: 7,
        [DayOfWeek.CLOSING_SUNDAY]: 8,
        [DayOfWeek.POST_EVENT]: 9
      };

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
        })).sort((a, b) => {
          const orderA = dayOfWeekOrder[a.shift.dayOfWeek as DayOfWeek] ?? 999;
          const orderB = dayOfWeekOrder[b.shift.dayOfWeek as DayOfWeek] ?? 999;
          return orderA - orderB;
        }) || []
        : [];

      const registrationDetails = {
        id: jobRegistration?.id || 'pending',
        year,
        status: jobRegistration?.status || 'PENDING',
        campingOptions,
        jobs,
        totalCost: totalCost > 0 ? totalCost * 100 : undefined, // Convert to cents
        currency: 'USD',
        paymentDeferred: options.paymentDeferred === true,
      };

      // Build user name for email personalization
      const userName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined;

      await this.notificationsService.sendRegistrationConfirmationEmail(
        user.email,
        registrationDetails,
        jobRegistration?.userId || '',
        userName,
        user.playaName || undefined
      );

      this.logger.log(`Registration confirmation email sent to ${user.email}`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Error sending registration confirmation email: ${err.message}`, err.stack);
      // Don't throw - email failures should not block registration
    }
  }

  /**
   * Send registration confirmation email for manually updated status
   * @param registration - Updated registration with user data
   */
  private async sendRegistrationConfirmationEmailForUpdatedStatus(
    registration: Registration & {
      user: { email: string; firstName?: string; lastName?: string; playaName?: string | null };
      jobs?: Array<{
        job?: {
          name?: string;
          category?: { name?: string };
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
  ): Promise<void> {
    try {
      // Get camping option registrations for this user
      const campingOptionRegistrations = await this.prisma.campingOptionRegistration.findMany({
        where: { userId: registration.userId },
        include: {
          campingOption: {
            include: { fields: true },
          },
        },
      });

      // Use the existing helper method to send the email
      await this.sendRegistrationConfirmationEmail(
        registration.user,
        registration as JobRegistrationWithJobs,
        campingOptionRegistrations,
        registration.year
      );

      this.logger.log(`Registration confirmation email sent for updated status to ${registration.user.email}`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Error sending registration confirmation email for updated status: ${err.message}`, err.stack);
      // Don't throw - email failures should not block registration updates
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

    // Check if user has any active registrations (non-cancelled)
    const activeJobRegistrations = jobRegistrations.filter(
      reg => reg.status !== RegistrationStatus.CANCELLED
    );

    return {
      campingOptions: campingOptionRegistrations,
      customFieldValues,
      jobRegistrations,
      hasRegistration: campingOptionRegistrations.length > 0 || activeJobRegistrations.length > 0,
    };
  }

  /**
   * Validate that a participant is not attempting to register for staff-only jobs.
   * The effective staffOnly status is derived from the job's category (see
   * JobsService.addDerivedPropertiesWithRegistrations), so validation checks
   * category.staffOnly to stay consistent with what the API exposes.
   * Staff and admin users are allowed to register for any job.
   * @param userRole - The role of the user
   * @param jobIds - The job IDs to validate
   * @throws ForbiddenException if a participant attempts to register for staff-only jobs
   */
  private async validateNoStaffOnlyJobsForParticipant(userRole: UserRole, jobIds: string[]): Promise<void> {
    if (userRole !== UserRole.PARTICIPANT || jobIds.length === 0) {
      return;
    }
    const staffOnlyJobs = await this.prisma.job.findMany({
      where: {
        id: { in: jobIds },
        category: { staffOnly: true },
      },
      select: { id: true },
    });
    if (staffOnlyJobs.length > 0) {
      throw new ForbiddenException('Participants cannot register for staff-only jobs');
    }
  }
}
