import { 
  Injectable, 
  Logger, 
  NotFoundException, 
  BadRequestException, 
  ConflictException 
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditService, CreateAuditRecordDto } from '../../admin-audit/services/admin-audit.service';
import { AdminNotificationsService, AdminNotificationData } from '../../notifications/services/admin-notifications.service';
import { RegistrationCleanupService } from './registration-cleanup.service';
import { 
  Registration, 
  RegistrationStatus, 
  AdminAuditActionType, 
  AdminAuditTargetType, 
  PaymentStatus,
  Prisma 
} from '@prisma/client';
import { 
  AdminEditRegistrationDto, 
  AdminCancelRegistrationDto, 
  AdminRegistrationResponseDto,
  AdminRegistrationQueryDto
} from '../dto/admin-registration.dto';
import { v4 as uuidv4 } from 'uuid';

export interface RefundInfo {
  hasPayments: boolean;
  totalAmount: number;
  paymentIds: string[];
  message: string;
}

/**
 * Service for administrative registration management operations
 */
@Injectable()
export class RegistrationAdminService {
  private readonly logger = new Logger(RegistrationAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAuditService: AdminAuditService,
    private readonly adminNotificationsService: AdminNotificationsService,
    private readonly cleanupService: RegistrationCleanupService,
  ) {}

  /**
   * Get registrations with filters and pagination for admin interface
   * @param query - Query parameters for filtering and pagination
   * @returns Paginated registration results
   */
  async getRegistrations(query: AdminRegistrationQueryDto): Promise<{
    registrations: Registration[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.RegistrationWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.year) {
      where.year = query.year;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.email || query.name) {
      where.user = {};
      if (query.email) {
        where.user.email = { contains: query.email, mode: 'insensitive' };
      }
      if (query.name) {
        where.user.OR = [
          { firstName: { contains: query.name, mode: 'insensitive' } },
          { lastName: { contains: query.name, mode: 'insensitive' } },
          { playaName: { contains: query.name, mode: 'insensitive' } },
        ];
      }
    }

    const [registrations, total] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              playaName: true,
              role: true,
            },
          },
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
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.registration.count({ where }),
    ]);

    return {
      registrations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Edit a registration with admin privileges
   * @param registrationId - ID of the registration to edit
   * @param editData - Data to update
   * @param adminUserId - ID of the admin performing the action
   * @returns Updated registration with transaction info
   */
  async editRegistration(
    registrationId: string,
    editData: AdminEditRegistrationDto,
    adminUserId: string,
  ): Promise<AdminRegistrationResponseDto> {
    const transactionId = uuidv4();
    this.logger.log(`Admin ${adminUserId} editing registration ${registrationId}`);

    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        // Get current registration with all related data
        const currentRegistration = await prisma.registration.findUnique({
          where: { id: registrationId },
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

        if (!currentRegistration) {
          throw new NotFoundException(`Registration ${registrationId} not found`);
        }

        if (currentRegistration.status === RegistrationStatus.CANCELLED) {
          throw new BadRequestException('Cannot edit a cancelled registration');
        }

        const auditRecords: CreateAuditRecordDto[] = [];

        // Update status if provided
        if (editData.status && editData.status !== currentRegistration.status) {
          await prisma.registration.update({
            where: { id: registrationId },
            data: { status: editData.status },
          });

          auditRecords.push({
            adminUserId,
            actionType: AdminAuditActionType.REGISTRATION_EDIT,
            targetRecordType: AdminAuditTargetType.REGISTRATION,
            targetRecordId: registrationId,
            oldValues: { status: currentRegistration.status },
            newValues: { status: editData.status },
            reason: editData.reason,
            transactionId,
          });
        }

        // Handle job changes
        if (editData.jobIds) {
          const currentJobIds = currentRegistration.jobs.map(rj => rj.jobId);
          const newJobIds = editData.jobIds;

          // Find jobs to remove
          const jobsToRemove = currentJobIds.filter(jobId => !newJobIds.includes(jobId));
          if (jobsToRemove.length > 0) {
            await this.cleanupService.cleanupWorkShifts(
              registrationId,
              adminUserId,
              `Work shifts modified: ${editData.reason}`,
              transactionId,
            );
          }

          // Find jobs to add
          const jobsToAdd = newJobIds.filter(jobId => !currentJobIds.includes(jobId));
          for (const jobId of jobsToAdd) {
            // Validate job exists
            const job = await prisma.job.findUnique({ where: { id: jobId } });
            if (!job) {
              throw new BadRequestException(`Job ${jobId} not found`);
            }

            // Add job to registration
            await prisma.registrationJob.create({
              data: {
                registrationId,
                jobId,
              },
            });

            auditRecords.push({
              adminUserId,
              actionType: AdminAuditActionType.WORK_SHIFT_ADD,
              targetRecordType: AdminAuditTargetType.WORK_SHIFT,
              targetRecordId: jobId,
              oldValues: undefined,
              newValues: { registrationId, jobId, jobName: job.name },
              reason: `Work shift added: ${editData.reason}`,
              transactionId,
            });
          }

          if (jobsToRemove.length > 0 || jobsToAdd.length > 0) {
            auditRecords.push({
              adminUserId,
              actionType: AdminAuditActionType.REGISTRATION_EDIT,
              targetRecordType: AdminAuditTargetType.REGISTRATION,
              targetRecordId: registrationId,
              oldValues: { jobIds: currentJobIds },
              newValues: { jobIds: newJobIds },
              reason: editData.reason,
              transactionId,
            });
          }
        }

        // Handle camping option changes
        if (editData.campingOptionIds) {
          // Get current camping options for this user
          const currentCampingOptions = await prisma.campingOptionRegistration.findMany({
            where: { userId: currentRegistration.userId },
            include: { campingOption: true },
          });

          const currentCampingOptionIds = currentCampingOptions.map(cor => cor.campingOptionId);
          const newCampingOptionIds = editData.campingOptionIds;

          // Find camping options to remove
          const campingOptionsToRemove = currentCampingOptionIds.filter(
            id => !newCampingOptionIds.includes(id)
          );
          if (campingOptionsToRemove.length > 0) {
            await this.cleanupService.cleanupCampingOptions(
              currentRegistration.userId,
              campingOptionsToRemove,
              adminUserId,
              `Camping options modified: ${editData.reason}`,
              transactionId,
            );
          }

          // Find camping options to add
          const campingOptionsToAdd = newCampingOptionIds.filter(
            id => !currentCampingOptionIds.includes(id)
          );
          for (const campingOptionId of campingOptionsToAdd) {
            // Validate camping option exists and has capacity
            const campingOption = await prisma.campingOption.findUnique({
              where: { id: campingOptionId },
              include: {
                registrations: true,
              },
            });

            if (!campingOption) {
              throw new BadRequestException(`Camping option ${campingOptionId} not found`);
            }

            if (campingOption.registrations.length >= campingOption.maxSignups) {
              throw new ConflictException(`Camping option ${campingOption.name} is at capacity`);
            }

            // Add camping option to user
            await prisma.campingOptionRegistration.create({
              data: {
                userId: currentRegistration.userId,
                campingOptionId,
              },
            });

            auditRecords.push({
              adminUserId,
              actionType: AdminAuditActionType.CAMPING_OPTION_ADD,
              targetRecordType: AdminAuditTargetType.CAMPING_OPTION,
              targetRecordId: campingOptionId,
              oldValues: undefined,
              newValues: { 
                userId: currentRegistration.userId, 
                campingOptionId, 
                campingOptionName: campingOption.name 
              },
              reason: `Camping option added: ${editData.reason}`,
              transactionId,
            });
          }

          if (campingOptionsToRemove.length > 0 || campingOptionsToAdd.length > 0) {
            auditRecords.push({
              adminUserId,
              actionType: AdminAuditActionType.REGISTRATION_EDIT,
              targetRecordType: AdminAuditTargetType.REGISTRATION,
              targetRecordId: registrationId,
              oldValues: { campingOptionIds: currentCampingOptionIds },
              newValues: { campingOptionIds: newCampingOptionIds },
              reason: editData.reason,
              transactionId,
            });
          }
        }

        // Create all audit records
        if (auditRecords.length > 0) {
          await this.adminAuditService.createMultipleAuditRecords(auditRecords, transactionId);
        }

        // Get final updated registration
        const finalRegistration = await prisma.registration.findUnique({
          where: { id: registrationId },
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

        return finalRegistration!;
      });

      // Send notification after successful transaction if requested
      let notificationStatus = 'No notification sent';
      if (editData.sendNotification) {
        try {
          // Get admin user info
          const adminUser = await this.prisma.user.findUnique({
            where: { id: adminUserId },
            select: { id: true, firstName: true, lastName: true, email: true },
          });

          if (adminUser) {
            // Get camping options for the user
            const campingOptions = await this.prisma.campingOptionRegistration.findMany({
              where: { userId: result.user.id },
              include: { campingOption: true },
            });

            const notificationData: AdminNotificationData = {
              adminUser,
              targetUser: {
                id: result.user.id,
                firstName: result.user.firstName,
                lastName: result.user.lastName,
                email: result.user.email,
                playaName: result.user.playaName || undefined,
              },
              registration: {
                id: result.id,
                year: result.year,
                status: result.status,
                campingOptions: campingOptions.map((cor: { campingOption: { name: string; description?: string | null } }) => ({
                  name: cor.campingOption.name,
                  description: cor.campingOption.description || undefined,
                })),
                jobs: result.jobs?.map((rj: { job: { name: string; category?: { name: string } | null; shift?: { name: string; startTime: string; endTime: string; dayOfWeek: string } | null } }) => ({
                  name: rj.job.name,
                  category: rj.job.category?.name || 'Uncategorized',
                  shift: {
                    name: rj.job.shift?.name || 'No shift',
                    startTime: rj.job.shift?.startTime || '',
                    endTime: rj.job.shift?.endTime || '',
                    dayOfWeek: rj.job.shift?.dayOfWeek || '',
                  },
                  location: 'TBD', // TODO: Add location field to job schema
                })) || [],
              },
              reason: editData.reason,
            };

            const success = await this.adminNotificationsService.sendRegistrationModificationNotification(notificationData);
            notificationStatus = success 
              ? 'Notification sent successfully to user'
              : 'Failed to send notification to user';
          } else {
            notificationStatus = 'Failed to send notification: Admin user not found';
          }
        } catch (error: unknown) {
          const err = error as Error;
          this.logger.warn(`Failed to send modification notification for registration ${registrationId}: ${err.message}`);
          notificationStatus = 'Failed to send notification to user';
        }
      }

      return {
        registration: result,
        transactionId,
        message: 'Registration successfully updated',
        notificationStatus,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to edit registration ${registrationId}: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Cancel a registration with cleanup and refund handling
   * @param registrationId - ID of the registration to cancel
   * @param cancelData - Cancellation data
   * @param adminUserId - ID of the admin performing the action
   * @returns Cancelled registration with cleanup and refund info
   */
  async cancelRegistration(
    registrationId: string,
    cancelData: AdminCancelRegistrationDto,
    adminUserId: string,
  ): Promise<AdminRegistrationResponseDto> {
    const transactionId = uuidv4();
    this.logger.log(`Admin ${adminUserId} cancelling registration ${registrationId}`);

    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        // Get current registration
        const registration = await prisma.registration.findUnique({
          where: { id: registrationId },
          include: {
            user: true,
            jobs: {
              include: {
                job: true,
              },
            },
            payments: {
              where: {
                status: {
                  in: [PaymentStatus.COMPLETED, PaymentStatus.PENDING],
                },
              },
            },
          },
        });

        if (!registration) {
          throw new NotFoundException(`Registration ${registrationId} not found`);
        }

        if (registration.status === RegistrationStatus.CANCELLED) {
          throw new BadRequestException('Registration is already cancelled');
        }

        // Check for refund requirements
        const refundInfo = this.calculateRefundInfo(registration.payments);

        // Update registration status to cancelled
        const cancelledRegistration = await prisma.registration.update({
          where: { id: registrationId },
          data: { status: RegistrationStatus.CANCELLED },
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

        // Create audit record for cancellation
        await this.adminAuditService.createAuditRecord({
          adminUserId,
          actionType: AdminAuditActionType.REGISTRATION_CANCEL,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: registrationId,
          oldValues: { status: registration.status },
          newValues: { status: RegistrationStatus.CANCELLED },
          reason: cancelData.reason,
          transactionId,
        });

        // Clean up related records
        const cleanupResult = await this.cleanupService.cleanupRegistration(
          registrationId,
          adminUserId,
          cancelData.reason,
          transactionId,
        );

        this.logger.log(
          `Registration ${registrationId} cancelled. Cleaned up ${cleanupResult.workShiftsRemoved} work shifts and ${cleanupResult.campingOptionsReleased} camping options`
        );

        return {
          registration: cancelledRegistration,
          refundInfo: cancelData.processRefund && refundInfo.hasPayments ? refundInfo.message : undefined,
        };
      });

      // Send notification after successful transaction if requested
      let notificationStatus = 'No notification sent';
      if (cancelData.sendNotification) {
        try {
          // Get admin user info
          const adminUser = await this.prisma.user.findUnique({
            where: { id: adminUserId },
            select: { id: true, firstName: true, lastName: true, email: true },
          });

          if (adminUser) {
            const notificationData: AdminNotificationData = {
              adminUser,
              targetUser: {
                id: result.registration.user.id,
                firstName: result.registration.user.firstName,
                lastName: result.registration.user.lastName,
                email: result.registration.user.email,
                playaName: result.registration.user.playaName || undefined,
              },
              registration: {
                id: result.registration.id,
                year: result.registration.year,
                status: 'CANCELLED',
              },
              reason: cancelData.reason,
              refundInfo: cancelData.processRefund && result.refundInfo ? {
                amount: 0, // TODO: Calculate actual refund amount
                currency: 'USD',
                processed: false,
              } : undefined,
            };

            const success = await this.adminNotificationsService.sendRegistrationCancellationNotification(notificationData);
            notificationStatus = success 
              ? 'Cancellation notification sent successfully to user'
              : 'Failed to send cancellation notification to user';
          } else {
            notificationStatus = 'Failed to send notification: Admin user not found';
          }
        } catch (error: unknown) {
          const err = error as Error;
          this.logger.warn(`Failed to send cancellation notification for registration ${registrationId}: ${err.message}`);
          notificationStatus = 'Failed to send notification to user';
        }
      }

      return {
        registration: result.registration,
        transactionId,
        message: 'Registration successfully cancelled',
        notificationStatus,
        refundInfo: result.refundInfo,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to cancel registration ${registrationId}: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get audit trail for a specific registration
   * @param registrationId - ID of the registration
   * @returns Audit trail records
   */
  async getRegistrationAuditTrail(registrationId: string) {
    return this.adminAuditService.getAuditTrail(
      AdminAuditTargetType.REGISTRATION,
      registrationId,
    );
  }

  /**
   * Calculate refund information for a registration's payments
   * @param payments - Array of payments
   * @returns Refund information
   */
  private calculateRefundInfo(payments: Array<{ id: string; amount: number; status: PaymentStatus }>): RefundInfo {
    const eligiblePayments = payments.filter(
      p => p.status === PaymentStatus.COMPLETED || p.status === PaymentStatus.PENDING
    );

    const totalAmount = eligiblePayments.reduce((sum, payment) => sum + payment.amount, 0);
    const paymentIds = eligiblePayments.map(p => p.id);

    return {
      hasPayments: eligiblePayments.length > 0,
      totalAmount,
      paymentIds,
      message: eligiblePayments.length > 0 
        ? `Refund of $${totalAmount.toFixed(2)} needs to be processed manually for ${eligiblePayments.length} payment(s)`
        : 'No payments to refund',
    };
  }
} 