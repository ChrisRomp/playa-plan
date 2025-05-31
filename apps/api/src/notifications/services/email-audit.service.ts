import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailAuditStatus, NotificationType } from '@prisma/client';

export interface EmailAuditData {
  recipientEmail: string;
  ccEmails?: string[];
  bccEmails?: string[];
  subject: string;
  notificationType: NotificationType;
  userId?: string;
  status: EmailAuditStatus;
  errorMessage?: string;
  sentAt?: Date;
}

/**
 * Service for logging email audit trail
 */
@Injectable()
export class EmailAuditService {
  private readonly logger = new Logger(EmailAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an email attempt to the audit trail
   * @param auditData - The email audit data to log
   * @returns Promise resolving to the created audit record
   */
  async logEmailAttempt(auditData: EmailAuditData): Promise<void> {
    try {
      const {
        recipientEmail,
        ccEmails,
        bccEmails,
        subject,
        notificationType,
        userId,
        status,
        errorMessage,
        sentAt
      } = auditData;

      await this.prisma.emailAudit.create({
        data: {
          recipientEmail,
          ccEmails: ccEmails?.join(',') || null,
          bccEmails: bccEmails?.join(',') || null,
          subject,
          notificationType,
          status,
          errorMessage: errorMessage || null,
          sentAt: sentAt || null,
          userId: userId || null,
          createdAt: new Date(),
        },
      });

      this.logger.debug(`Email audit logged for ${recipientEmail} with status ${status}`);
    } catch (error) {
      // Audit logging should not block email operations
      // Log the error but don't throw
      this.logger.error(`Failed to log email audit for ${auditData.recipientEmail}`, error);
    }
  }

  /**
   * Log a successful email send
   * @param recipientEmail - Recipient email address
   * @param subject - Email subject
   * @param notificationType - Type of notification
   * @param userId - Optional user ID associated with the email
   * @param ccEmails - Optional CC recipients
   * @param bccEmails - Optional BCC recipients
   */
  async logEmailSent(
    recipientEmail: string,
    subject: string,
    notificationType: NotificationType,
    userId?: string,
    ccEmails?: string[],
    bccEmails?: string[]
  ): Promise<void> {
    await this.logEmailAttempt({
      recipientEmail,
      ccEmails,
      bccEmails,
      subject,
      notificationType,
      userId,
      status: EmailAuditStatus.SENT,
      sentAt: new Date(),
    });
  }

  /**
   * Log a failed email send
   * @param recipientEmail - Recipient email address
   * @param subject - Email subject
   * @param notificationType - Type of notification
   * @param errorMessage - Error message describing the failure
   * @param userId - Optional user ID associated with the email
   * @param ccEmails - Optional CC recipients
   * @param bccEmails - Optional BCC recipients
   */
  async logEmailFailed(
    recipientEmail: string,
    subject: string,
    notificationType: NotificationType,
    errorMessage: string,
    userId?: string,
    ccEmails?: string[],
    bccEmails?: string[]
  ): Promise<void> {
    await this.logEmailAttempt({
      recipientEmail,
      ccEmails,
      bccEmails,
      subject,
      notificationType,
      userId,
      status: EmailAuditStatus.FAILED,
      errorMessage,
    });
  }

  /**
   * Log an email that was disabled (not sent due to global toggle)
   * @param recipientEmail - Recipient email address
   * @param subject - Email subject
   * @param notificationType - Type of notification
   * @param userId - Optional user ID associated with the email
   * @param ccEmails - Optional CC recipients
   * @param bccEmails - Optional BCC recipients
   */
  async logEmailDisabled(
    recipientEmail: string,
    subject: string,
    notificationType: NotificationType,
    userId?: string,
    ccEmails?: string[],
    bccEmails?: string[]
  ): Promise<void> {
    await this.logEmailAttempt({
      recipientEmail,
      ccEmails,
      bccEmails,
      subject,
      notificationType,
      userId,
      status: EmailAuditStatus.DISABLED,
    });
  }

  /**
   * Get email audit statistics for a time period
   * @param startDate - Start date for the statistics
   * @param endDate - End date for the statistics
   * @returns Email audit statistics
   */
  async getEmailStatistics(startDate: Date, endDate: Date): Promise<{
    totalEmails: number;
    sentEmails: number;
    failedEmails: number;
    disabledEmails: number;
    byNotificationType: Record<string, number>;
  }> {
    try {
      const audits = await this.prisma.emailAudit.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          status: true,
          notificationType: true,
        },
      });

      const totalEmails = audits.length;
      const sentEmails = audits.filter(a => a.status === EmailAuditStatus.SENT).length;
      const failedEmails = audits.filter(a => a.status === EmailAuditStatus.FAILED).length;
      const disabledEmails = audits.filter(a => a.status === EmailAuditStatus.DISABLED).length;

      const byNotificationType = audits.reduce((acc, audit) => {
        acc[audit.notificationType] = (acc[audit.notificationType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalEmails,
        sentEmails,
        failedEmails,
        disabledEmails,
        byNotificationType,
      };
    } catch (error) {
      this.logger.error('Failed to get email statistics', error);
      return {
        totalEmails: 0,
        sentEmails: 0,
        failedEmails: 0,
        disabledEmails: 0,
        byNotificationType: {},
      };
    }
  }
} 