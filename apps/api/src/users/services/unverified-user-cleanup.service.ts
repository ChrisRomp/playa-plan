import { Injectable, Logger } from '@nestjs/common';
import { AdminAuditActionType, AdminAuditTargetType, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DeleteUnverifiedUsersResult,
  SkippedUnverifiedUserCleanup,
  UnverifiedUserCleanupPage,
  UnverifiedUserCleanupSkipReason,
} from '../models/unverified-user-cleanup.model';

export const UNVERIFIED_USER_CLEANUP_AGE_DAYS = 30;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const CLEANUP_CANDIDATE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

const CLEANUP_RELATION_COUNT_SELECT = {
  registrations: true,
  passkeys: true,
  campingOptionRegistrations: true,
  payments: true,
  processedPaymentRefunds: true,
  authoredNotes: true,
  notes: true,
  reviewedRegistrations: true,
  adminAuditRecords: true,
} as const satisfies Prisma.UserCountOutputTypeSelect;

type CleanupSkipSnapshot = Prisma.UserGetPayload<{
  select: {
    id: true;
    role: true;
    isEmailVerified: true;
    createdAt: true;
    loginCodeExpiry: true;
    _count: {
      select: typeof CLEANUP_RELATION_COUNT_SELECT;
    };
  };
}>;

/**
 * Finds and permanently removes stale unverified participant accounts.
 */
@Injectable()
export class UnverifiedUserCleanupService {
  private readonly logger = new Logger(UnverifiedUserCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List participant accounts currently eligible for unverified-email cleanup.
   */
  async listEligibleUsers(
    page: number,
    limit: number,
    now: Date = new Date()
  ): Promise<UnverifiedUserCleanupPage> {
    const where = this.buildEligibilityWhere(now);
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: CLEANUP_CANDIDATE_SELECT,
        orderBy: [{ createdAt: 'asc' }, { email: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: total === 0 ? 1 : Math.ceil(total / limit),
      minimumAgeDays: UNVERIFIED_USER_CLEANUP_AGE_DAYS,
    };
  }

  /**
   * Permanently delete selected accounts that still satisfy every cleanup guard.
   */
  async deleteEligibleUsers(
    ids: readonly string[],
    adminUserId: string,
    now: Date = new Date()
  ): Promise<DeleteUnverifiedUsersResult> {
    const uniqueIds = [...new Set(ids)];
    const eligibilityWhere = this.buildEligibilityWhere(now);
    const transactionId = randomUUID();

    const result = await this.prisma.$transaction(async transaction => {
      const snapshots = await transaction.user.findMany({
        where: {
          ...eligibilityWhere,
          id: { in: uniqueIds },
        },
        select: {
          ...CLEANUP_CANDIDATE_SELECT,
          emailAudit: {
            select: {
              id: true,
            },
          },
        },
      });

      await transaction.user.deleteMany({
        where: {
          ...eligibilityWhere,
          id: { in: snapshots.map(user => user.id) },
        },
      });

      const skippedIds = uniqueIds.filter(id => !snapshots.some(user => user.id === id));
      const remainingEligibleSnapshotUsers = await transaction.user.findMany({
        where: {
          id: { in: snapshots.map(user => user.id) },
        },
        select: {
          id: true,
        },
      });
      const remainingSnapshotIds = new Set(remainingEligibleSnapshotUsers.map(user => user.id));
      const deletedSnapshots = snapshots.filter(user => !remainingSnapshotIds.has(user.id));
      skippedIds.push(...remainingEligibleSnapshotUsers.map(user => user.id));
      const emailAuditIds = deletedSnapshots.flatMap(user =>
        user.emailAudit.map(audit => audit.id)
      );

      if (emailAuditIds.length > 0) {
        await transaction.emailAudit.deleteMany({
          where: {
            id: { in: emailAuditIds },
          },
        });
      }

      if (deletedSnapshots.length > 0) {
        await transaction.adminAudit.createMany({
          data: deletedSnapshots.map(user => ({
            adminUserId,
            actionType: AdminAuditActionType.USER_DELETE,
            targetRecordType: AdminAuditTargetType.USER,
            targetRecordId: user.id,
            oldValues: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              createdAt: user.createdAt.toISOString(),
            },
            reason: 'Unverified account cleanup',
            transactionId,
          })),
        });
      }

      const skipped = await this.getSkippedUsers(transaction, skippedIds, now, this.getCutoff(now));

      const deleted = deletedSnapshots.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      }));
      return { deleted, skipped };
    });

    this.logger.log(
      `Admin ${adminUserId} requested cleanup of ${uniqueIds.length} accounts: ` +
        `${result.deleted.length} deleted, ${result.skipped.length} skipped`
    );

    return result;
  }

  private buildEligibilityWhere(now: Date): Prisma.UserWhereInput {
    return {
      role: UserRole.PARTICIPANT,
      isEmailVerified: false,
      createdAt: {
        lte: this.getCutoff(now),
      },
      OR: [
        { loginCodeExpiry: null },
        {
          loginCodeExpiry: {
            lte: now,
          },
        },
      ],
      registrations: { none: {} },
      passkeys: { none: {} },
      campingOptionRegistrations: { none: {} },
      payments: { none: {} },
      processedPaymentRefunds: { none: {} },
      authoredNotes: { none: {} },
      notes: { none: {} },
      reviewedRegistrations: { none: {} },
      adminAuditRecords: { none: {} },
    };
  }

  private getCutoff(now: Date): Date {
    return new Date(now.getTime() - UNVERIFIED_USER_CLEANUP_AGE_DAYS * MILLISECONDS_PER_DAY);
  }

  private async getSkippedUsers(
    transaction: Prisma.TransactionClient,
    ids: readonly string[],
    now: Date,
    cutoff: Date
  ): Promise<SkippedUnverifiedUserCleanup[]> {
    if (ids.length === 0) {
      return [];
    }

    const users = await transaction.user.findMany({
      where: {
        id: { in: [...ids] },
      },
      select: {
        id: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        loginCodeExpiry: true,
        _count: {
          select: CLEANUP_RELATION_COUNT_SELECT,
        },
      },
    });
    const usersById = new Map(users.map(user => [user.id, user]));

    return ids.map(id => {
      const user = usersById.get(id);
      return {
        id,
        reason: user ? this.getSkipReason(user, now, cutoff) : 'NOT_FOUND',
      };
    });
  }

  private getSkipReason(
    user: CleanupSkipSnapshot,
    now: Date,
    cutoff: Date
  ): UnverifiedUserCleanupSkipReason {
    if (user.role !== UserRole.PARTICIPANT) {
      return 'PROTECTED_ROLE';
    }
    if (user.isEmailVerified) {
      return 'ALREADY_VERIFIED';
    }
    if (user.createdAt > cutoff) {
      return 'TOO_NEW';
    }
    if (user.loginCodeExpiry && user.loginCodeExpiry > now) {
      return 'ACTIVE_LOGIN';
    }
    if (user._count.registrations > 0) {
      return 'HAS_REGISTRATIONS';
    }
    if (user._count.passkeys > 0) {
      return 'HAS_PASSKEYS';
    }

    return 'HAS_RELATED_ACTIVITY';
  }
}
