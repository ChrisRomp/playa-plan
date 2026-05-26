import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAuditActionType,
  AdminAuditTargetType,
  NotificationType,
  Prisma,
  RegistrationStatus,
} from '@prisma/client';
import { AdminAuditService } from '../../admin-audit/services/admin-audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { APPLICATION_STATUSES } from '../constants/registration-status.constants';
import {
  ApplicationQueryDto,
  ApproveApplicationDto,
  BulkApplicationActionDto,
  DeclineApplicationDto,
} from '../dto/application-admin.dto';

const APPLICATION_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  playaName: true,
  role: true,
} as const;

const APPLICATION_REVIEW_INCLUDE = {
  user: { select: APPLICATION_USER_SELECT },
  campingOptionRegistrations: {
    include: {
      campingOption: {
        select: {
          id: true,
          name: true,
          description: true,
          enabled: true,
        },
      },
    },
  },
} as const;

const APPLICATION_LIST_INCLUDE = APPLICATION_REVIEW_INCLUDE;

const APPLICATION_DETAIL_INCLUDE = {
  user: { select: APPLICATION_USER_SELECT },
  reviewedBy: { select: APPLICATION_USER_SELECT },
  campingOptionRegistrations: {
    include: {
      campingOption: true,
      fieldValues: {
        include: {
          field: true,
        },
      },
    },
  },
} as const;

type ApplicationListItem = Prisma.RegistrationGetPayload<{
  include: typeof APPLICATION_LIST_INCLUDE;
}>;

type ApplicationReviewRecord = Prisma.RegistrationGetPayload<{
  include: typeof APPLICATION_REVIEW_INCLUDE;
}>;

type ApplicationDetailRecord = Prisma.RegistrationGetPayload<{
  include: typeof APPLICATION_DETAIL_INCLUDE;
}>;

type BulkApplicationResult = {
  id: string;
  status: 'approved' | 'declined' | 'skipped';
  error?: string;
};

interface ApplicationDecisionParams {
  readonly actionType: AdminAuditActionType;
  readonly adminUserId: string;
  readonly existingApplication?: ApplicationReviewRecord;
  readonly id: string;
  readonly message: string | null;
  readonly nextStatus: RegistrationStatus;
}

/** Administrative application review operations for registration approval workflows. */
@Injectable()
export class ApplicationAdminService {
  private readonly logger = new Logger(ApplicationAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAuditService: AdminAuditService,
    private readonly notificationsService: NotificationsService,
    private readonly coreConfigService: CoreConfigService,
  ) {}

  /** List applications for admin review. */
  async listApplications(query: ApplicationQueryDto): Promise<{
    data: ApplicationListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const currentConfig = await this.coreConfigService.findCurrent();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const status = this.resolveQueryStatus(query.status);
    const year = query.year ?? currentConfig.registrationYear;
    const where: Prisma.RegistrationWhereInput = {
      year,
      status,
    };

    const searchTerm = query.search?.trim();
    if (searchTerm) {
      const tokens = searchTerm.split(/\s+/).filter(Boolean);
      const buildSearchClauses = (value: string): Prisma.UserWhereInput[] => [
        { firstName: { contains: value, mode: 'insensitive' } },
        { lastName: { contains: value, mode: 'insensitive' } },
        { playaName: { contains: value, mode: 'insensitive' } },
        { email: { contains: value, mode: 'insensitive' } },
      ];

      where.user =
        tokens.length === 1
          ? { OR: buildSearchClauses(tokens[0]) }
          : {
              AND: tokens.map((token) => ({
                OR: buildSearchClauses(token),
              })),
            };
    }

    const [data, total] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        include: APPLICATION_LIST_INCLUDE,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.registration.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /** Get the full detail for a single application. */
  async getApplicationDetail(id: string): Promise<ApplicationDetailRecord> {
    const application = await this.prisma.registration.findFirst({
      where: {
        id,
        status: {
          in: [...APPLICATION_STATUSES],
        },
      },
      include: APPLICATION_DETAIL_INCLUDE,
    });

    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    return application;
  }

  /** Approve a submitted application. */
  async approveApplication(
    id: string,
    adminUserId: string,
    dto: ApproveApplicationDto,
  ): Promise<ApplicationDetailRecord> {
    const application = await this.updateApplicationDecision({
      id,
      adminUserId,
      message: dto.message ?? null,
      nextStatus: RegistrationStatus.APPLICATION_APPROVED,
      actionType: AdminAuditActionType.APPLICATION_APPROVE,
    });

    await this.sendDecisionNotification(application, NotificationType.APPLICATION_APPROVED);
    return application;
  }

  /** Decline a submitted application. */
  async declineApplication(
    id: string,
    adminUserId: string,
    dto: DeclineApplicationDto,
  ): Promise<ApplicationDetailRecord> {
    const application = await this.updateApplicationDecision({
      id,
      adminUserId,
      message: dto.message,
      nextStatus: RegistrationStatus.APPLICATION_DECLINED,
      actionType: AdminAuditActionType.APPLICATION_DECLINE,
    });

    await this.sendDecisionNotification(application, NotificationType.APPLICATION_DECLINED);
    return application;
  }

  /** Approve or decline multiple submitted applications. */
  async bulkProcessApplications(
    adminUserId: string,
    dto: BulkApplicationActionDto,
  ): Promise<{
    results: BulkApplicationResult[];
    processed: number;
    skipped: number;
  }> {
    if (dto.action === 'decline' && !dto.message?.trim()) {
      throw new BadRequestException('Message is required when declining applications');
    }

    const applications = await this.prisma.registration.findMany({
      where: {
        id: {
          in: dto.ids,
        },
      },
      include: APPLICATION_REVIEW_INCLUDE,
    });
    const applicationsById = new Map(applications.map((application) => [application.id, application]));
    const results: BulkApplicationResult[] = [];
    const notifications: Array<{
      application: ApplicationDetailRecord;
      type: NotificationType;
    }> = [];

    for (const id of dto.ids) {
      const application = applicationsById.get(id);
      if (!application) {
        results.push({
          id,
          status: 'skipped',
          error: 'Application not found',
        });
        continue;
      }

      if (application.status !== RegistrationStatus.APPLICATION_SUBMITTED) {
        results.push({
          id,
          status: 'skipped',
          error: 'Application is not in a reviewable state',
        });
        continue;
      }

      try {
        const updatedApplication = await this.updateApplicationDecision({
          id,
          adminUserId,
          existingApplication: application,
          message: dto.message ?? null,
          nextStatus:
            dto.action === 'approve'
              ? RegistrationStatus.APPLICATION_APPROVED
              : RegistrationStatus.APPLICATION_DECLINED,
          actionType:
            dto.action === 'approve'
              ? AdminAuditActionType.APPLICATION_APPROVE
              : AdminAuditActionType.APPLICATION_DECLINE,
        });

        results.push({
          id,
          status: dto.action === 'approve' ? 'approved' : 'declined',
        });
        notifications.push({
          application: updatedApplication,
          type:
            dto.action === 'approve'
              ? NotificationType.APPLICATION_APPROVED
              : NotificationType.APPLICATION_DECLINED,
        });
      } catch (error: unknown) {
        results.push({
          id,
          status: 'skipped',
          error: error instanceof Error ? error.message : 'Failed to process application',
        });
      }
    }

    await Promise.allSettled(
      notifications.map(async ({ application, type }) => this.sendDecisionNotification(application, type)),
    );

    const processed = results.filter((result) => result.status !== 'skipped').length;
    const skipped = results.filter((result) => result.status === 'skipped').length;

    return {
      results,
      processed,
      skipped,
    };
  }

  private resolveQueryStatus(status?: ApplicationQueryDto['status']): RegistrationStatus {
    if (!status) {
      return RegistrationStatus.APPLICATION_SUBMITTED;
    }

    if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException('Status must be an application status');
    }

    return status;
  }

  private async loadApplicationForReview(
    id: string,
    existingApplication?: ApplicationReviewRecord,
  ): Promise<ApplicationReviewRecord> {
    if (existingApplication) {
      return existingApplication;
    }

    const application = await this.prisma.registration.findUnique({
      where: { id },
      include: APPLICATION_REVIEW_INCLUDE,
    });

    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    return application;
  }

  private async updateApplicationDecision(
    params: ApplicationDecisionParams,
  ): Promise<ApplicationDetailRecord> {
    const currentApplication = await this.loadApplicationForReview(
      params.id,
      params.existingApplication,
    );

    if (currentApplication.status !== RegistrationStatus.APPLICATION_SUBMITTED) {
      throw new BadRequestException('Application is not in a reviewable state');
    }

    const reviewedAt = new Date();
    const updatedApplication = await this.prisma.$transaction(async (tx) => {
      const updatedCount = await tx.registration.updateMany({
        where: {
          id: params.id,
          status: RegistrationStatus.APPLICATION_SUBMITTED,
        },
        data: {
          status: params.nextStatus,
          reviewedById: params.adminUserId,
          reviewedAt,
          decisionMessage: params.message,
        },
      });

      if (updatedCount.count === 0) {
        throw new BadRequestException('Application is not in a reviewable state');
      }

      return tx.registration.findUniqueOrThrow({
        where: { id: params.id },
        include: APPLICATION_DETAIL_INCLUDE,
      });
    });

    await this.adminAuditService.createAuditRecord({
      adminUserId: params.adminUserId,
      actionType: params.actionType,
      targetRecordType: AdminAuditTargetType.REGISTRATION,
      targetRecordId: params.id,
      oldValues: {
        status: currentApplication.status,
        decisionMessage: currentApplication.decisionMessage,
      },
      newValues: {
        status: params.nextStatus,
        decisionMessage: params.message,
        reviewedById: params.adminUserId,
        reviewedAt: reviewedAt.toISOString(),
      },
      reason: params.message ?? undefined,
    });

    return updatedApplication;
  }

  private async sendDecisionNotification(
    application: ApplicationDetailRecord,
    notificationType: NotificationType,
  ): Promise<void> {
    const fullName = [application.user.firstName, application.user.lastName]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .trim();
    const wasSent = await this.notificationsService.sendNotification(
      application.user.email,
      notificationType,
      {
        userId: application.user.id,
        name: fullName || undefined,
        playaName: application.user.playaName ?? undefined,
        applicationDetails: {
          year: application.year,
          decisionMessage: application.decisionMessage ?? undefined,
          campingOptions: application.campingOptionRegistrations.map((registration) => ({
            name: registration.campingOption.name,
          })),
        },
      },
    );

    if (!wasSent) {
      this.logger.warn(
        `Application notification ${notificationType} was not sent to ${application.user.email}`,
      );
      return;
    }

    this.logger.log(
      `Application notification ${notificationType} sent to ${application.user.email}`,
    );
  }
}
