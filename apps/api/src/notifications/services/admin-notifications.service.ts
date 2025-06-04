import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService, TemplateData } from './notifications.service';
import { EmailAuditService } from './email-audit.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { NotificationType } from '@prisma/client';

export interface AdminNotificationData {
  /** Admin user who performed the action */
  adminUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  /** User receiving the notification */
  targetUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    playaName?: string;
  };
  /** Registration details */
  registration: {
    id: string;
    year: number;
    status: string;
    campingOptions?: Array<{
      name: string;
      description?: string;
    }>;
    jobs?: Array<{
      name: string;
      category: string;
      shift: {
        name: string;
        startTime: string;
        endTime: string;
        dayOfWeek: string;
      };
      location: string;
    }>;
  };
  /** Reason for the change provided by admin */
  reason: string;
  /** Optional refund information for cancellations */
  refundInfo?: {
    amount: number;
    currency: string;
    processed: boolean;
  };
}

interface AdminInfo {
  name: string;
  email: string;
  reason: string;
}

interface RefundInfo {
  amount: number;
  currency: string;
  processed: boolean;
}

/**
 * Service for handling admin-triggered user notifications
 * Sends emails to users when admins modify or cancel their registrations
 */
@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly emailAuditService: EmailAuditService,
    private readonly coreConfigService: CoreConfigService,
  ) {}

  /**
   * Send notification to user about registration modification by admin
   * @param data Admin notification data including admin info, user info, and changes
   * @returns Promise resolving to true if notification was sent successfully
   */
  async sendRegistrationModificationNotification(data: AdminNotificationData): Promise<boolean> {
    try {
      this.logger.log(`Sending registration modification notification to ${data.targetUser.email} for registration ${data.registration.id}`);

      // Get camp name from configuration
      const campName = await this.getCampName();

      // Prepare template data for registration modification
      const templateData: TemplateData = {
        name: data.targetUser.firstName,
        playaName: data.targetUser.playaName,
        campName,
        userId: data.targetUser.id,
        registrationDetails: {
          id: data.registration.id,
          year: data.registration.year,
          status: data.registration.status,
          campingOptions: data.registration.campingOptions,
          jobs: data.registration.jobs,
        },
        adminInfo: {
          name: `${data.adminUser.firstName} ${data.adminUser.lastName}`,
          email: data.adminUser.email,
          reason: data.reason,
        },
      };

      // Use the existing registration confirmation template format but with admin modification context
      const success = await this.notificationsService.sendNotification(
        data.targetUser.email,
        NotificationType.REGISTRATION_CONFIRMATION,
        templateData,
      );

      // Log the notification attempt
      await this.logNotificationAttempt(
        NotificationType.REGISTRATION_CONFIRMATION,
        data.targetUser.email,
        success,
        data.adminUser.id,
        data.targetUser.id,
      );

      return success;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send registration modification notification: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      
      // Log the failed attempt
      await this.logNotificationAttempt(
        NotificationType.REGISTRATION_CONFIRMATION,
        data.targetUser.email,
        false,
        data.adminUser.id,
        data.targetUser.id,
        errorMessage,
      );

      return false;
    }
  }

  /**
   * Send notification to user about registration cancellation by admin
   * @param data Admin notification data including cancellation details and optional refund info
   * @returns Promise resolving to true if notification was sent successfully
   */
  async sendRegistrationCancellationNotification(data: AdminNotificationData): Promise<boolean> {
    try {
      this.logger.log(`Sending registration cancellation notification to ${data.targetUser.email} for registration ${data.registration.id}`);

      // Get camp name from configuration
      const campName = await this.getCampName();

      // Prepare template data for registration cancellation
      const templateData: TemplateData = {
        name: data.targetUser.firstName,
        playaName: data.targetUser.playaName,
        campName,
        userId: data.targetUser.id,
        registrationDetails: {
          id: data.registration.id,
          year: data.registration.year,
          status: 'CANCELLED',
        },
        adminInfo: {
          name: `${data.adminUser.firstName} ${data.adminUser.lastName}`,
          email: data.adminUser.email,
          reason: data.reason,
        },
        refundInfo: data.refundInfo,
      };

      // Send cancellation notification using a custom template
      const success = await this.sendCancellationEmail(data.targetUser.email, templateData);

      // Log the notification attempt
      await this.logNotificationAttempt(
        NotificationType.REGISTRATION_ERROR,
        data.targetUser.email,
        success,
        data.adminUser.id,
        data.targetUser.id,
      );

      return success;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send registration cancellation notification: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      
      // Log the failed attempt
      await this.logNotificationAttempt(
        NotificationType.REGISTRATION_ERROR,
        data.targetUser.email,
        false,
        data.adminUser.id,
        data.targetUser.id,
        errorMessage,
      );

      return false;
    }
  }

  /**
   * Get the camp name from core configuration
   * @returns Camp name or fallback to 'PlayaPlan'
   */
  private async getCampName(): Promise<string> {
    try {
      const config = await this.coreConfigService.findCurrent(false);
      return config?.campName || 'PlayaPlan';
    } catch {
      this.logger.warn('Failed to get camp name from configuration, using fallback');
      return 'PlayaPlan';
    }
  }

  /**
   * Send cancellation email with custom template
   * @param email Recipient email
   * @param templateData Template data for the email
   * @returns Promise resolving to true if email was sent successfully
   */
  private async sendCancellationEmail(email: string, templateData: TemplateData): Promise<boolean> {
    // For now, we'll create a simple cancellation notice
    // In a full implementation, this would use a dedicated cancellation template
    const greeting = this.getGreeting(templateData.name, templateData.playaName);
    const adminInfo = templateData.adminInfo as AdminInfo;
    const refundInfo = templateData.refundInfo as RefundInfo | undefined;
    
    const refundMessage = refundInfo?.processed 
      ? `A refund of $${(refundInfo.amount / 100).toFixed(2)} has been processed. If paid by credit card, your refund will appear on your payment method within 5-10 business days.`
      : '';

    const subject = `Registration Cancelled - ${templateData.campName} ${templateData.registrationDetails?.year}`;
    
    const text = `${greeting}

We are writing to inform you that your registration for ${templateData.campName} ${templateData.registrationDetails?.year} has been cancelled by our administrative team.

Registration Details:
- Registration ID: ${templateData.registrationDetails?.id}
- Year: ${templateData.registrationDetails?.year}
- Status: Cancelled

Reason for Cancellation:
${adminInfo?.reason}

${refundMessage}

If you have any questions about this cancellation, please contact us.

Thank you for your understanding.

Best regards,
${templateData.campName} Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #d97706;">Registration Cancelled</h2>
        
        <p>${greeting}</p>
        
        <p>We are writing to inform you that your registration for <strong>${templateData.campName} ${templateData.registrationDetails?.year}</strong> has been cancelled by our administrative team.</p>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Registration Details</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Registration ID:</strong> ${templateData.registrationDetails?.id}</li>
            <li><strong>Year:</strong> ${templateData.registrationDetails?.year}</li>
            <li><strong>Status:</strong> Cancelled</li>
          </ul>
        </div>
        
        <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #991b1b;">Reason for Cancellation</h3>
          <p style="margin: 0;">${adminInfo?.reason}</p>
        </div>
        
        ${refundMessage ? `
        <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #166534;">Refund Information</h3>
          <p style="margin: 0;">${refundMessage}</p>
        </div>
        ` : ''}
        
        <p>If you have any questions about this cancellation, please contact us.</p>
        
        <p>Thank you for your understanding.</p>
        
        <p>Best regards,<br>
        <strong>${templateData.campName} Team</strong></p>
      </div>
    `;

    // Use the notification service's email functionality
    return this.notificationsService.sendNotification(email, NotificationType.REGISTRATION_ERROR, {
      ...templateData,
      customSubject: subject,
      customText: text,
      customHtml: html,
    });
  }

  /**
   * Get appropriate greeting for the user
   * @param userName User's first name
   * @param playaName User's playa name
   * @returns Formatted greeting string
   */
  private getGreeting(userName?: string, playaName?: string): string {
    if (playaName && userName) {
      return `Hi ${userName} (${playaName}),`;
    } else if (userName) {
      return `Hi ${userName},`;
    } else if (playaName) {
      return `Hi ${playaName},`;
    } else {
      return 'Hello,';
    }
  }

  /**
   * Log notification attempt to email audit system
   * @param notificationType Type of notification
   * @param recipient Email recipient
   * @param success Whether the notification was sent successfully
   * @param adminUserId ID of admin who triggered the notification
   * @param targetUserId ID of user receiving the notification
   * @param errorMessage Optional error message if failed
   */
  private async logNotificationAttempt(
    notificationType: NotificationType,
    recipient: string,
    success: boolean,
    adminUserId: string,
    targetUserId: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const subject = `Admin ${notificationType} Notification`;
      
      if (success) {
        await this.emailAuditService.logEmailSent(
          recipient,
          subject,
          notificationType,
          targetUserId,
        );
      } else {
        await this.emailAuditService.logEmailFailed(
          recipient,
          subject,
          notificationType,
          errorMessage || 'Unknown error',
          targetUserId,
        );
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to log notification attempt: ${errorMsg}`, error instanceof Error ? error.stack : undefined);
    }
  }
}

export default AdminNotificationsService; 