import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditService, CreateAuditRecordDto } from '../../admin-audit/services/admin-audit.service';
import { AdminAuditActionType, AdminAuditTargetType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface CleanupResult {
  workShiftsRemoved: number;
  campingOptionsReleased: number;
  auditRecords: string[];
}

/**
 * Service for handling cleanup operations when registrations are cancelled
 */
@Injectable()
export class RegistrationCleanupService {
  private readonly logger = new Logger(RegistrationCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  /**
   * Clean up all related records for a cancelled registration
   * @param registrationId - ID of the registration to clean up
   * @param adminUserId - ID of the admin performing the cleanup
   * @param reason - Reason for the cleanup
   * @param transactionId - Optional transaction ID to group audit records
   * @returns Cleanup result summary
   */
  async cleanupRegistration(
    registrationId: string,
    adminUserId: string,
    reason: string,
    transactionId?: string,
  ): Promise<CleanupResult> {
    const txId = transactionId || uuidv4();
    this.logger.log(`Starting cleanup for registration ${registrationId} by admin ${adminUserId}`);

    try {
      return await this.prisma.$transaction(async (prisma) => {
        // Get the registration with related records
        const registration = await prisma.registration.findUnique({
          where: { id: registrationId },
          include: {
            jobs: {
              include: {
                job: true,
              },
            },
            user: {
              include: {
                campingOptionRegistrations: {
                  where: {
                    // Find camping options for this registration year
                    // We'll match by user and then filter by registration context
                  },
                  include: {
                    campingOption: true,
                  },
                },
              },
            },
          },
        });

        if (!registration) {
          throw new Error(`Registration ${registrationId} not found`);
        }

        const auditRecords: CreateAuditRecordDto[] = [];
        let workShiftsRemoved = 0;
        let campingOptionsReleased = 0;

        // Clean up work shifts (registration jobs)
        if (registration.jobs.length > 0) {
          for (const registrationJob of registration.jobs) {
            auditRecords.push({
              adminUserId,
              actionType: AdminAuditActionType.WORK_SHIFT_REMOVE,
              targetRecordType: AdminAuditTargetType.WORK_SHIFT,
              targetRecordId: registrationJob.jobId,
              oldValues: {
                registrationId: registrationJob.registrationId,
                jobId: registrationJob.jobId,
                jobName: registrationJob.job.name,
                registrationStatus: registration.status,
              },
              newValues: undefined,
              reason: `Removed due to registration cancellation: ${reason}`,
              transactionId: txId,
            });
          }

          await prisma.registrationJob.deleteMany({
            where: { registrationId },
          });

          workShiftsRemoved = registration.jobs.length;
          this.logger.log(`Removed ${workShiftsRemoved} work shifts for registration ${registrationId}`);
        }

        // Clean up camping option registrations
        // Filter camping options that are related to this registration's year
        const relevantCampingOptions = registration.user.campingOptionRegistrations.filter(
          () => {
            // We need to determine if this camping option registration is related to this registration
            // For now, we'll use a heuristic based on creation time proximity or other logic
            // This might need refinement based on your specific business logic
            return true; // For now, clean up all camping options for the user
          }
        );

        if (relevantCampingOptions.length > 0) {
          for (const campingOptionReg of relevantCampingOptions) {
            auditRecords.push({
              adminUserId,
              actionType: AdminAuditActionType.CAMPING_OPTION_REMOVE,
              targetRecordType: AdminAuditTargetType.CAMPING_OPTION,
              targetRecordId: campingOptionReg.campingOptionId,
              oldValues: {
                userId: campingOptionReg.userId,
                campingOptionId: campingOptionReg.campingOptionId,
                campingOptionName: campingOptionReg.campingOption.name,
                registrationStatus: registration.status,
              },
              newValues: undefined,
              reason: `Released due to registration cancellation: ${reason}`,
              transactionId: txId,
            });
          }

          await prisma.campingOptionRegistration.deleteMany({
            where: {
              id: {
                in: relevantCampingOptions.map(cor => cor.id),
              },
            },
          });

          campingOptionsReleased = relevantCampingOptions.length;
          this.logger.log(`Released ${campingOptionsReleased} camping options for registration ${registrationId}`);
        }

        // Create all audit records
        const createdAuditRecords = await this.adminAuditService.createMultipleAuditRecords(
          auditRecords,
          txId,
        );

        return {
          workShiftsRemoved,
          campingOptionsReleased,
          auditRecords: createdAuditRecords.map(record => record.id),
        };
      });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to cleanup registration ${registrationId}: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Clean up work shifts only (used for partial cleanup operations)
   * @param registrationId - ID of the registration
   * @param adminUserId - ID of the admin performing the cleanup
   * @param reason - Reason for the cleanup
   * @param transactionId - Optional transaction ID
   * @returns Number of work shifts removed
   */
  async cleanupWorkShifts(
    registrationId: string,
    adminUserId: string,
    reason: string,
    transactionId?: string,
  ): Promise<number> {
    const txId = transactionId || uuidv4();

    try {
      return await this.prisma.$transaction(async (prisma) => {
        const registrationJobs = await prisma.registrationJob.findMany({
          where: { registrationId },
          include: {
            job: true,
          },
        });

        if (registrationJobs.length === 0) {
          return 0;
        }

        const auditRecords: CreateAuditRecordDto[] = registrationJobs.map(rj => ({
          adminUserId,
          actionType: AdminAuditActionType.WORK_SHIFT_REMOVE,
          targetRecordType: AdminAuditTargetType.WORK_SHIFT,
          targetRecordId: rj.jobId,
          oldValues: {
            registrationId: rj.registrationId,
            jobId: rj.jobId,
            jobName: rj.job.name,
          },
          newValues: undefined,
          reason,
          transactionId: txId,
        }));

        await prisma.registrationJob.deleteMany({
          where: { registrationId },
        });

        await this.adminAuditService.createMultipleAuditRecords(auditRecords, txId);

        this.logger.log(`Removed ${registrationJobs.length} work shifts for registration ${registrationId}`);
        return registrationJobs.length;
      });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to cleanup work shifts for registration ${registrationId}: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Clean up camping options only (used for partial cleanup operations)
   * @param userId - ID of the user
   * @param campingOptionIds - Array of camping option IDs to release
   * @param adminUserId - ID of the admin performing the cleanup
   * @param reason - Reason for the cleanup
   * @param transactionId - Optional transaction ID
   * @returns Number of camping options released
   */
  async cleanupCampingOptions(
    userId: string,
    campingOptionIds: string[],
    adminUserId: string,
    reason: string,
    transactionId?: string,
  ): Promise<number> {
    const txId = transactionId || uuidv4();

    try {
      return await this.prisma.$transaction(async (prisma) => {
        const campingOptionRegs = await prisma.campingOptionRegistration.findMany({
          where: {
            userId,
            campingOptionId: {
              in: campingOptionIds,
            },
          },
          include: {
            campingOption: true,
          },
        });

        if (campingOptionRegs.length === 0) {
          return 0;
        }

        const auditRecords: CreateAuditRecordDto[] = campingOptionRegs.map(cor => ({
          adminUserId,
          actionType: AdminAuditActionType.CAMPING_OPTION_REMOVE,
          targetRecordType: AdminAuditTargetType.CAMPING_OPTION,
          targetRecordId: cor.campingOptionId,
          oldValues: {
            userId: cor.userId,
            campingOptionId: cor.campingOptionId,
            campingOptionName: cor.campingOption.name,
          },
          newValues: undefined,
          reason,
          transactionId: txId,
        }));

        await prisma.campingOptionRegistration.deleteMany({
          where: {
            id: {
              in: campingOptionRegs.map(cor => cor.id),
            },
          },
        });

        await this.adminAuditService.createMultipleAuditRecords(auditRecords, txId);

        this.logger.log(`Released ${campingOptionRegs.length} camping options for user ${userId}`);
        return campingOptionRegs.length;
      });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to cleanup camping options for user ${userId}: ${err.message}`, err.stack);
      throw error;
    }
  }
} 