import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAudit, AdminAuditActionType, AdminAuditTargetType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface CreateAuditRecordDto {
  adminUserId: string;
  actionType: AdminAuditActionType;
  targetRecordType: AdminAuditTargetType;
  targetRecordId: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  reason?: string;
  transactionId?: string;
  throwOnError?: boolean;
}

export interface AdminAuditWithUser extends AdminAudit {
  adminUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Service for handling admin audit trail operations
 */
@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new audit record
   * @param data - Audit record data
   * @returns The created audit record, or fallback record if error occurs and throwOnError is false
   */
  async createAuditRecord(data: CreateAuditRecordDto): Promise<AdminAudit> {
    try {
      return await this.prisma.adminAudit.create({
        data: {
          adminUserId: data.adminUserId,
          actionType: data.actionType,
          targetRecordType: data.targetRecordType,
          targetRecordId: data.targetRecordId,
          oldValues: data.oldValues ?? Prisma.DbNull,
          newValues: data.newValues ?? Prisma.DbNull,
          reason: data.reason,
          transactionId: data.transactionId,
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to create audit record: ${err.message}`, err.stack);
      
      // If throwOnError is explicitly set to true, or not specified (defaults to true for critical operations)
      if (data.throwOnError !== false) {
        throw error;
      }
      
      // For non-critical operations, return a minimal audit record to indicate failure
      // This prevents audit logging from blocking main operations
      return {
        id: '',
        adminUserId: data.adminUserId,
        actionType: data.actionType,
        targetRecordType: data.targetRecordType,
        targetRecordId: data.targetRecordId,
        oldValues: null,
        newValues: null,
        reason: data.reason || null,
        transactionId: data.transactionId || null,
        createdAt: new Date(),
      } as AdminAudit;
    }
  }

  /**
   * Create multiple audit records within a transaction
   * @param records - Array of audit record data
   * @param transactionId - Optional transaction ID to group related records
   * @returns Array of created audit records
   */
  async createMultipleAuditRecords(
    records: CreateAuditRecordDto[],
    transactionId?: string,
  ): Promise<AdminAudit[]> {
    const txId = transactionId || uuidv4();
    
    try {
      return await this.prisma.$transaction(
        records.map(record =>
          this.prisma.adminAudit.create({
            data: {
              ...record,
              transactionId: txId,
              oldValues: record.oldValues ?? Prisma.DbNull,
              newValues: record.newValues ?? Prisma.DbNull,
              reason: record.reason,
            },
          }),
        ),
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to create multiple audit records: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get audit trail for a specific target record
   * @param targetRecordType - Type of target record
   * @param targetRecordId - ID of target record
   * @returns Array of audit records with admin user information
   */
  async getAuditTrail(
    targetRecordType: AdminAuditTargetType,
    targetRecordId: string,
  ): Promise<AdminAuditWithUser[]> {
    return this.prisma.adminAudit.findMany({
      where: {
        targetRecordType,
        targetRecordId,
      },
      include: {
        adminUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get audit records grouped by transaction ID
   * @param transactionId - Transaction ID to filter by
   * @returns Array of audit records with admin user information
   */
  async getAuditRecordsByTransaction(transactionId: string): Promise<AdminAuditWithUser[]> {
    return this.prisma.adminAudit.findMany({
      where: {
        transactionId,
      },
      include: {
        adminUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Get all audit records with admin user information (paginated)
   * @param page - Page number (1-based)
   * @param limit - Number of records per page
   * @param filters - Optional filters
   * @returns Paginated audit records
   */
  async getAllAuditRecords(
    page = 1,
    limit = 50,
    filters?: {
      adminUserId?: string;
      actionType?: AdminAuditActionType;
      targetRecordType?: AdminAuditTargetType;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Promise<{
    records: AdminAuditWithUser[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    
    const where: Prisma.AdminAuditWhereInput = {};
    
    if (filters) {
      if (filters.adminUserId) {
        where.adminUserId = filters.adminUserId;
      }
      if (filters.actionType) {
        where.actionType = filters.actionType;
      }
      if (filters.targetRecordType) {
        where.targetRecordType = filters.targetRecordType;
      }
      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) {
          where.createdAt.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          where.createdAt.lte = filters.dateTo;
        }
      }
    }

    const [records, total] = await Promise.all([
      this.prisma.adminAudit.findMany({
        where,
        include: {
          adminUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.adminAudit.count({ where }),
    ]);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit statistics
   * @returns Statistics about audit records
   */
  async getAuditStatistics(): Promise<{
    totalRecords: number;
    recordsByActionType: Record<AdminAuditActionType, number>;
    recordsByTargetType: Record<AdminAuditTargetType, number>;
    recentActivityCount: number;
  }> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const [
      totalRecords,
      recordsByActionType,
      recordsByTargetType,
      recentActivityCount,
    ] = await Promise.all([
      this.prisma.adminAudit.count(),
      this.prisma.adminAudit.groupBy({
        by: ['actionType'],
        _count: true,
      }),
      this.prisma.adminAudit.groupBy({
        by: ['targetRecordType'],
        _count: true,
      }),
      this.prisma.adminAudit.count({
        where: {
          createdAt: {
            gte: twentyFourHoursAgo,
          },
        },
      }),
    ]);

    // Convert grouped results to record format
    const actionTypeStats = recordsByActionType.reduce(
      (acc, item) => {
        acc[item.actionType] = item._count;
        return acc;
      },
      {} as Record<AdminAuditActionType, number>,
    );

    const targetTypeStats = recordsByTargetType.reduce(
      (acc, item) => {
        acc[item.targetRecordType] = item._count;
        return acc;
      },
      {} as Record<AdminAuditTargetType, number>,
    );

    return {
      totalRecords,
      recordsByActionType: actionTypeStats,
      recordsByTargetType: targetTypeStats,
      recentActivityCount,
    };
  }
} 