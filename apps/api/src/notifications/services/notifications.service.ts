import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService, EmailOptions } from './email.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { NotificationType } from '@prisma/client';

export interface NotificationTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface TemplateData {
  name?: string;
  playaName?: string;
  resetUrl?: string;
  verificationUrl?: string;
  loginCode?: string;
  oldEmail?: string;
  newEmail?: string;
  campName?: string;
  paymentDetails?: {
    id: string;
    amount: number;
    currency: string;
    date: Date;
  };
  shiftDetails?: {
    id: string;
    jobName: string;
    date: Date;
    startTime: string;
    endTime: string;
    location: string;
  };
  registrationDetails?: {
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
    totalCost?: number;
    currency?: string;
  };
  errorDetails?: {
    error: string;
    message: string;
    suggestions?: string[];
  };
  testEmailDetails?: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    senderEmail: string;
    senderName: string;
    adminUserName: string;
    adminEmail: string;
    timestamp: Date;
    customContent?: {
      subject?: string;
      message?: string;
      format?: 'html' | 'text';
      includeSmtpDetails?: boolean;
    };
  };
  adminInfo?: {
    name: string;
    email: string;
    reason: string;
  };
  userId?: string;
  [key: string]: unknown;
}

/**
 * Service that handles various notifications across the application
 * Uses EmailService to send actual emails
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly baseUrl: string;
  private readonly isDebugMode: boolean;
  
  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly coreConfigService: CoreConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3000');
    this.isDebugMode = this.configService.get<string>('nodeEnv') === 'development' || 
                        process.argv.includes('--debug');
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
   * Send a notification email
   * @param to Recipient email or array of emails
   * @param type Type of notification to send
   * @param data Data used to populate notification templates
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendNotification(
    to: string | string[],
    type: NotificationType,
    data: TemplateData,
  ): Promise<boolean> {
    try {
      // Get camp name from configuration and include it in template data
      const campName = await this.getCampName();
      const templateData = { ...data, campName };
      
      const template = this.getNotificationTemplate(type, templateData);
      
      const emailOptions: EmailOptions = {
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
        notificationType: type,
        userId: data.userId,
      };
      
      // Log notification to console in debug mode
      if (this.isDebugMode) {
        this.logNotificationToConsole(type, emailOptions);
      }
      
      return await this.emailService.sendEmail(emailOptions);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to send ${type} notification: ${err.message}`, err.stack);
      return false;
    }
  }
  
  /**
   * Log notification to console when in debug mode
   * @param type Type of notification being sent
   * @param options Email options including recipient and content
   */
  private logNotificationToConsole(type: NotificationType, options: EmailOptions): void {
    const recipient = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    
    console.log('\n=============== DEBUG MODE: EMAIL NOTIFICATION ===============');
    console.log(`Type: ${type}`);
    console.log(`To: ${recipient}`);
    console.log(`Subject: ${options.subject}`);
    console.log('\n--- PLAIN TEXT CONTENT ---');
    console.log(options.text);
    console.log('===============================================================\n');
  }

  /**
   * Send password reset email with token
   * @param email User email address
   * @param token Reset token
   * @param userId Optional user ID for audit trail
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendPasswordResetEmail(email: string, token: string, userId?: string): Promise<boolean> {
    const resetUrl = `${this.baseUrl}/reset-password?token=${token}`;
    return this.sendNotification(email, NotificationType.PASSWORD_RESET, { resetUrl, userId });
  }

  /**
   * Send email verification email with token
   * @param email User email address
   * @param token Verification token
   * @param userId Optional user ID for audit trail
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendEmailVerificationEmail(email: string, token: string, userId?: string): Promise<boolean> {
    const verificationUrl = `${this.baseUrl}/verify-email?token=${token}`;
    return this.sendNotification(email, NotificationType.EMAIL_VERIFICATION, { verificationUrl, userId });
  }

  /**
   * Send payment confirmation email
   * @param email User email address
   * @param paymentDetails Payment details
   * @param userId Optional user ID for audit trail
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendPaymentConfirmationEmail(
    email: string, 
    paymentDetails: { 
      id: string; 
      amount: number; 
      currency: string; 
      date: Date;
    },
    userId?: string
  ): Promise<boolean> {
    return this.sendNotification(email, NotificationType.PAYMENT_CONFIRMATION, { paymentDetails, userId });
  }

  /**
   * Send login verification code email
   * @param email User email address
   * @param code Verification code
   * @param userId Optional user ID for audit trail
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendLoginCodeEmail(email: string, code: string, userId?: string): Promise<boolean> {
    return this.sendNotification(email, NotificationType.EMAIL_AUTHENTICATION, { loginCode: code, userId });
  }

  /**
   * Send email change notification to old email address
   * @param oldEmail Previous email address
   * @param newEmail New email address that was set
   * @param userId User ID for audit trail
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendEmailChangeNotificationToOldEmail(oldEmail: string, newEmail: string, userId: string): Promise<boolean> {
    return this.sendNotification(oldEmail, NotificationType.EMAIL_CHANGE, { 
      oldEmail, 
      newEmail, 
      userId,
      isToOldEmail: true 
    });
  }

  /**
   * Send email change confirmation to new email address
   * @param newEmail New email address
   * @param oldEmail Previous email address
   * @param userId User ID for audit trail
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendEmailChangeNotificationToNewEmail(newEmail: string, oldEmail: string, userId: string): Promise<boolean> {
    return this.sendNotification(newEmail, NotificationType.EMAIL_CHANGE, { 
      oldEmail, 
      newEmail, 
      userId,
      isToOldEmail: false 
    });
  }

  /**
   * Send registration confirmation email
   * @param email User email address
   * @param registrationDetails Registration details including camping options, jobs, and payment
   * @param userId User ID for audit trail
   * @param userName User's full name (first + last)
   * @param playaName User's playa name (if any)
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendRegistrationConfirmationEmail(
    email: string,
    registrationDetails: {
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
      totalCost?: number;
      currency?: string;
    },
    userId: string,
    userName?: string,
    playaName?: string
  ): Promise<boolean> {
    return this.sendNotification(email, NotificationType.REGISTRATION_CONFIRMATION, { 
      registrationDetails, 
      userId,
      name: userName,
      playaName
    });
  }

  /**
   * Send registration error notification email
   * @param email User email address
   * @param errorDetails Error details with message and suggestions
   * @param userId User ID for audit trail
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendRegistrationErrorEmail(
    email: string,
    errorDetails: {
      error: string;
      message: string;
      suggestions?: string[];
    },
    userId: string
  ): Promise<boolean> {
    return this.sendNotification(email, NotificationType.REGISTRATION_ERROR, { 
      errorDetails, 
      userId 
    });
  }

  /**
   * Send test email with SMTP configuration details and admin info
   * @param email Email address(es) to send test email to
   * @param testEmailDetails SMTP configuration and admin details
   * @param userId User ID for audit trail
   * @param customContent Optional custom subject and message content
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendTestEmail(
    email: string,
    testEmailDetails: {
      smtpHost: string;
      smtpPort: number;
      smtpSecure: boolean;
      senderEmail: string;
      senderName: string;
      adminUserName: string;
      adminEmail: string;
      timestamp: Date;
    },
    userId: string,
    customContent?: {
      subject?: string;
      message?: string;
      format?: 'html' | 'text';
      includeSmtpDetails?: boolean;
    }
  ): Promise<boolean> {
    // Parse multiple email addresses if comma-separated
    const recipients = email.split(',').map(e => e.trim()).filter(e => e.length > 0);
    
    // Validate all email addresses using a safer regex pattern
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    for (const recipient of recipients) {
      if (!emailRegex.test(recipient)) {
        throw new Error(`Invalid email address: ${recipient}`);
      }
    }

    let successful = true;

    // Send to each recipient
    for (const recipient of recipients) {
      try {
        const result = await this.sendNotification(
          recipient, 
          NotificationType.EMAIL_TEST, 
          { 
            testEmailDetails: {
              ...testEmailDetails,
              customContent,
            }, 
            userId 
          }
        );
        
        if (!result) {
          successful = false;
        }
      } catch (error) {
        successful = false;
        // Log the error but continue with other recipients
        const errorMessage = error instanceof Error ? error.message : String(error);
        const sanitizedRecipient = recipient.replace(/[%\r\n]/g, '');
        console.error(`Failed to send test email to ${sanitizedRecipient}: ${errorMessage}`);
      }
    }

    return successful;
  }

  /**
   * Get template for specific notification type
   * @param type Notification type
   * @param data Template data
   * @returns Prepared template with subject, text and HTML content
   */
  private getNotificationTemplate(type: NotificationType, data: TemplateData): NotificationTemplate {
    switch (type) {
      case NotificationType.PASSWORD_RESET:
        return this.getPasswordResetTemplate(data.resetUrl || '', data.campName || '');
      case NotificationType.EMAIL_VERIFICATION:
        return this.getEmailVerificationTemplate(data.verificationUrl || '', data.campName || '');
      case NotificationType.EMAIL_AUTHENTICATION:
        return this.getLoginCodeTemplate(data.loginCode || '', data.campName || '');
      case NotificationType.EMAIL_CHANGE:
        return this.getEmailChangeTemplate(
          data.oldEmail || '', 
          data.newEmail || '', 
          Boolean(data.isToOldEmail),
          data.campName || ''
        );
      case NotificationType.PAYMENT_CONFIRMATION:
        if (!data.paymentDetails) {
          throw new Error('Payment details are required for payment confirmation template');
        }
        return this.getPaymentConfirmationTemplate(data.paymentDetails, data.campName || '');
      case NotificationType.REGISTRATION_CONFIRMATION:
        if (!data.registrationDetails) {
          throw new Error('Registration details are required for registration confirmation template');
        }
        return this.getRegistrationConfirmationTemplate(data.registrationDetails, data.campName || '', data);
      case NotificationType.REGISTRATION_ERROR:
        // Handle both error details and custom cancellation templates
        if (data.customSubject && data.customText && data.customHtml) {
          return {
            subject: data.customSubject as string,
            text: data.customText as string,
            html: data.customHtml as string,
          };
        }
        if (!data.errorDetails) {
          throw new Error('Error details are required for registration error template');
        }
        return this.getRegistrationErrorTemplate(data.errorDetails, data.campName || '');
      case NotificationType.SHIFT_REMINDER:
        if (!data.shiftDetails) {
          throw new Error('Shift details are required for shift reminder template');
        }
        return this.getShiftReminderTemplate(data.shiftDetails, data.campName || '');
      case NotificationType.EMAIL_TEST:
        if (!data.testEmailDetails) {
          throw new Error('Test email details are required for test email template');
        }
        return this.getTestEmailTemplate(data.testEmailDetails, data.campName || '');
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
  }

  /**
   * Get welcome email template
   */
  private getWelcomeTemplate(name: string, campName: string): NotificationTemplate {
    const subject = `Welcome to ${campName}!`;
    const text = `
      Hi ${name},
      
      Welcome to ${campName}! We're excited to have you on board.
      
      You can now sign in to your account and start exploring our services.
      
      Best regards,
      The ${campName} Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${campName}!</h2>
        <p>Hi ${name},</p>
        <p>Welcome to ${campName}! We're excited to have you on board.</p>
        <p>You can now sign in to your account and start exploring our services.</p>
        <p>Best regards,<br>The ${campName} Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get password reset email template
   */
  private getPasswordResetTemplate(resetUrl: string, campName: string): NotificationTemplate {
    const subject = `Reset Your ${campName} Password`;
    const text = `
      Hi there,
      
      You've requested to reset your password. Click the link below to set a new password:
      
      ${resetUrl}
      
      This link will expire in 1 hour. If you didn't request this, please ignore this email.
      
      Best regards,
      The ${campName} Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>Hi there,</p>
        <p>You've requested to reset your password. Click the button below to set a new password:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The ${campName} Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get email verification template
   */
  private getEmailVerificationTemplate(verificationUrl: string, campName: string): NotificationTemplate {
    const subject = `Verify Your ${campName} Email`;
    const text = `
      Hi there,
      
      Please verify your email address by clicking the link below:
      
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      Best regards,
      The ${campName} Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify Your Email</h2>
        <p>Hi there,</p>
        <p>Please verify your email address by clicking the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email</a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>Best regards,<br>The ${campName} Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get login code email template
   */
  private getLoginCodeTemplate(code: string, campName: string): NotificationTemplate {
    const subject = `Your ${campName} Login Code`;
    const text = `
      Hello,
      
      Your verification code to log in to ${campName} is: ${code}
      
      This code will expire in 15 minutes. If you did not request this code, please ignore this email.
      
      Best regards,
      The ${campName} Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Login Verification Code</h2>
        <p>Hello,</p>
        <p>Your verification code to log in to ${campName} is:</p>
        <div style="background-color: #f5f5f5; padding: 15px; font-size: 24px; text-align: center; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
          ${code}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request this code, please ignore this email.</p>
        <p>Best regards,<br>The ${campName} Team</p>
      </div>
    `;
    return { subject, text, html };
  }

  /**
   * Get payment confirmation template
   */
  private getPaymentConfirmationTemplate(paymentDetails: { id: string; amount: number; currency: string; date: Date }, campName: string): NotificationTemplate {
    const { id, amount, currency, date } = paymentDetails;
    const formattedDate = new Date(date).toLocaleDateString();
    const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
    
    const subject = 'Payment Confirmation';
    const text = `
      Hi there,
      
      We've received your payment of ${formattedAmount} on ${formattedDate}.
      
      Payment ID: ${id}
      
      Thank you for your payment!
      
      Best regards,
      The ${campName} Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Confirmation</h2>
        <p>Hi there,</p>
        <p>We've received your payment of ${formattedAmount} on ${formattedDate}.</p>
        <p><strong>Payment ID:</strong> ${id}</p>
        <p>Thank you for your payment!</p>
        <p>Best regards,<br>The ${campName} Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get email change template
   */
  private getEmailChangeTemplate(oldEmail: string, newEmail: string, isToOldEmail: boolean, campName: string): NotificationTemplate {
    const subject = isToOldEmail ? 'Email Change Notification' : 'Email Change Confirmation';
    const text = `
      Hi there,
      
      Your email address has been changed.
      
      Old Email: ${oldEmail}
      New Email: ${newEmail}
      
      If you did not request this change, please contact support immediately.
      
      Best regards,
      The ${campName} Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>Hi there,</p>
        <p>Your email address has been changed.</p>
        <p><strong>Old Email:</strong> ${oldEmail}</p>
        <p><strong>New Email:</strong> ${newEmail}</p>
        <p>If you did not request this change, please contact support immediately.</p>
        <p>Best regards,<br>The ${campName} Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Convert registration status enum to user-friendly text
   * @param status Raw status value
   * @returns User-friendly status text
   */
  private getFriendlyRegistrationStatus(status: string): string {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'Pending';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'WAITLISTED':
        return 'Waitlisted';
      case 'CANCELLED':
        return 'Cancelled';
      case 'REJECTED':
        return 'Rejected';
      default:
        return status;
    }
  }

  /**
   * Convert DayOfWeek enum to user-friendly text
   * @param day Raw day enum value
   * @returns User-friendly day text
   */
  private getFriendlyDayName(day: string): string {
    if (!day) return '';
    
    const dayMap: Record<string, string> = {
      // Standard days
      MONDAY: 'Monday',
      TUESDAY: 'Tuesday',
      WEDNESDAY: 'Wednesday',
      THURSDAY: 'Thursday',
      FRIDAY: 'Friday',
      SATURDAY: 'Saturday',
      SUNDAY: 'Sunday',
      // Special event days
      PRE_OPENING: 'Pre-Opening',
      OPENING_SUNDAY: 'Opening Sunday',
      CLOSING_SUNDAY: 'Closing Sunday',
      POST_EVENT: 'Post-Event',
      // Handle lowercase versions too
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
      pre_opening: 'Pre-Opening',
      opening_sunday: 'Opening Sunday',
      closing_sunday: 'Closing Sunday',
      post_event: 'Post-Event'
    };
    
    return dayMap[day] || day; // Return mapped value or original if not found
  }

  /**
   * Get appropriate greeting based on available name information
   * @param userName Full name (first + last)
   * @param playaName Playa name
   * @returns Appropriate greeting
   */
  private getGreeting(userName?: string, playaName?: string): string {
    if (playaName && playaName.trim()) {
      return `Hi ${playaName.trim()},`;
    }
    if (userName && userName.trim()) {
      return `Hi ${userName.trim()},`;
    }
    return 'Hi there,';
  }

  /**
   * Get registration status message based on status
   * @param status Registration status
   * @returns Appropriate status message
   */
  private getRegistrationStatusMessage(status: string): string {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'Your registration has been received and is pending review or payment.';
      case 'CONFIRMED':
        return 'Your registration has been confirmed.';
      case 'WAITLISTED':
        return 'Your registration has been received and you have been placed on the waitlist.';
      case 'CANCELLED':
        return 'Your registration has been cancelled.';
      case 'REJECTED':
        return 'Your registration has been reviewed and unfortunately was not approved.';
      default:
        return 'Your registration has been received.';
    }
  }

  /**
   * Get registration confirmation template
   */
  private getRegistrationConfirmationTemplate(registrationDetails: {
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
    totalCost?: number;
    currency?: string;
  }, campName: string, data?: TemplateData): NotificationTemplate {
    const { status, campingOptions, jobs, totalCost, currency } = registrationDetails;
    const formattedDate = new Date().toLocaleDateString();
    const formattedAmount = totalCost ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(totalCost / 100) : 'N/A';
    
    const greeting = this.getGreeting(data?.name, data?.playaName);
    const friendlyStatus = this.getFriendlyRegistrationStatus(status);
    
    // Check if this is an admin modification
    const isAdminModification = Boolean(data?.adminInfo);
    const adminInfo = data?.adminInfo;
    
    const subject = isAdminModification 
      ? `Registration Modified - ${campName} ${registrationDetails.year}`
      : 'Registration Confirmation';
      
    const statusMessage = isAdminModification
      ? `Your registration for ${campName} ${registrationDetails.year} has been modified by our administrative team.`
      : this.getRegistrationStatusMessage(status);
    
    const adminSection = isAdminModification && adminInfo ? `

Administrative Changes:
- Modified by: ${adminInfo.name}
- Reason: ${adminInfo.reason}
- Contact: ${adminInfo.email}

Your current registration details are shown below.` : '';

    const adminHtmlSection = isAdminModification && adminInfo ? `
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <h3 style="margin-top: 0; color: #92400e;">Administrative Changes</h3>
        <ul style="margin: 5px 0; padding-left: 20px;">
          <li><strong>Modified by:</strong> ${adminInfo.name}</li>
          <li><strong>Reason:</strong> ${adminInfo.reason}</li>
          <li><strong>Contact:</strong> <a href="mailto:${adminInfo.email}">${adminInfo.email}</a></li>
        </ul>
        <p style="margin: 10px 0 0 0; font-style: italic;">Your current registration details are shown below.</p>
      </div>
    ` : '';
    
    const text = `${greeting}
      
${statusMessage}${adminSection}
      
Status: ${friendlyStatus}
Date: ${formattedDate}
Total Dues: ${formattedAmount}
      
Selected Options:
${campingOptions ? campingOptions.map(option => `- ${option.name}`).join('\n') : 'N/A'}
      
Work Shift(s):
${jobs ? jobs.map(job => `- ${job.category}: ${this.getFriendlyDayName(job.shift.dayOfWeek)} ${job.shift.startTime}-${job.shift.endTime}`).join('\n') : 'N/A'}
      
${isAdminModification ? `If you have any questions about these changes, please contact ${adminInfo?.email}.` : 'Thank you for registering with ' + campName + '!'}
      
Best regards,
The ${campName} Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: ${isAdminModification ? '#d97706' : '#059669'};">${subject}</h2>
        <p>${greeting}</p>
        <p>${statusMessage}</p>
        
        ${adminHtmlSection}
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Registration Details</h3>
          <p><strong>Status:</strong> ${friendlyStatus}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Total Dues:</strong> ${formattedAmount}</p>
        </div>
        
        <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0369a1;">Selected Options</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${campingOptions ? campingOptions.map(option => `<li>${option.name}</li>`).join('') : '<li>N/A</li>'}
          </ul>
        </div>
        
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #166534;">Work Shift(s)</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${jobs ? jobs.map(job => `<li>${job.category}: ${this.getFriendlyDayName(job.shift.dayOfWeek)} ${job.shift.startTime}-${job.shift.endTime}</li>`).join('') : '<li>N/A</li>'}
          </ul>
        </div>
        
        <p>${isAdminModification ? `If you have any questions about these changes, please contact <a href="mailto:${adminInfo?.email}">${adminInfo?.email}</a>.` : `Thank you for registering with ${campName}!`}</p>
        
        <p>Best regards,<br>
        <strong>The ${campName} Team</strong></p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get registration error template
   */
  private getRegistrationErrorTemplate(errorDetails: {
    error: string;
    message: string;
    suggestions?: string[];
  }, campName: string): NotificationTemplate {
    const { error, message, suggestions } = errorDetails;
    
    const subject = 'Registration Error Notification';
    const text = `
      Hi there,
      
      We're sorry, but there was an error processing your registration.
      
      Error: ${error}
      Message: ${message}
      
      Suggestions:
      ${suggestions ? suggestions.map(suggestion => `- ${suggestion}`).join('\n') : 'N/A'}
      
      Please try again later or contact support for assistance.
      
      Best regards,
      The ${campName} Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>Hi there,</p>
        <p>We're sorry, but there was an error processing your registration.</p>
        <p><strong>Error:</strong> ${error}</p>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Suggestions:</strong></p>
        <ul>
          ${suggestions ? suggestions.map(suggestion => `<li>- ${suggestion}</li>`).join('') : '<li>N/A</li>'}
        </ul>
        <p>Please try again later or contact support for assistance.</p>
        <p>Best regards,<br>The ${campName} Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get shift reminder template
   */
  private getShiftReminderTemplate(shiftDetails: {
    id: string;
    jobName: string;
    date: Date;
    startTime: string;
    endTime: string;
    location: string;
  }, campName: string): NotificationTemplate {
    const { id, jobName, date, startTime, endTime, location } = shiftDetails;
    const formattedDate = new Date(date).toLocaleDateString();
    
    const subject = 'Shift Reminder';
    const text = `
      Hi there,
      
      Your shift is coming up soon:
      
      Job: ${jobName}
      Date: ${formattedDate}
      Time: ${startTime} - ${endTime}
      Location: ${location}
      Shift ID: ${id}
      
      Please make sure to arrive on time.
      
      Best regards,
      The ${campName} Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>Hi there,</p>
        <p>Your shift is coming up soon:</p>
        <p style="background-color: #f5f5f5; padding: 15px; border-radius: 4px;">
          <strong>Job:</strong> ${jobName}<br>
          <strong>Date:</strong> ${formattedDate}<br>
          <strong>Time:</strong> ${startTime} - ${endTime}<br>
          <strong>Location:</strong> ${location}<br>
          <strong>Shift ID:</strong> ${id}
        </p>
        <p>Please make sure to arrive on time.</p>
        <p>Best regards,<br>The ${campName} Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get test email template
   */
  private getTestEmailTemplate(testEmailDetails: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    senderEmail: string;
    senderName: string;
    adminUserName: string;
    adminEmail: string;
    timestamp: Date;
    customContent?: {
      subject?: string;
      message?: string;
      format?: 'html' | 'text';
      includeSmtpDetails?: boolean;
    };
  }, campName: string): NotificationTemplate {
    const { 
      smtpHost, 
      smtpPort, 
      smtpSecure, 
      senderEmail, 
      senderName, 
      adminUserName, 
      adminEmail, 
      timestamp,
      customContent 
    } = testEmailDetails;
    
    // Use custom subject if provided, otherwise use default with camp name
    const subject = customContent?.subject || `Test Email from ${campName}`;
    
    // Use custom message if provided, otherwise use default
    const customMessage = customContent?.message || 'This is a test email to verify your SMTP configuration is working correctly.';
    
    // Determine if SMTP details should be included
    const includeSmtpDetails = customContent?.includeSmtpDetails !== false; // Default to true
    
    const formattedTimestamp = new Date(timestamp).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    // Build email content based on format preference
    const isHtmlFormat = customContent?.format !== 'text'; // Default to HTML

    if (isHtmlFormat) {
      // HTML format
      const smtpDetailsHtml = includeSmtpDetails ? `
        <div style="margin-top: 24px; padding: 16px; background-color: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #495057; font-size: 16px;">SMTP Configuration</h3>
          <table style="width: 100%; font-family: monospace; font-size: 14px;">
            <tr><td style="padding: 4px 8px; font-weight: bold;">Host:</td><td style="padding: 4px 8px;">${smtpHost}</td></tr>
            <tr><td style="padding: 4px 8px; font-weight: bold;">Port:</td><td style="padding: 4px 8px;">${smtpPort}</td></tr>
            <tr><td style="padding: 4px 8px; font-weight: bold;">SSL:</td><td style="padding: 4px 8px;">${smtpSecure ? 'Yes' : 'No'}</td></tr>
            <tr><td style="padding: 4px 8px; font-weight: bold;">Sender:</td><td style="padding: 4px 8px;">${senderName} &lt;${senderEmail}&gt;</td></tr>
          </table>
        </div>` : '';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #343a40; margin-bottom: 8px;">${subject}</h1>
            <p style="color: #6c757d; margin: 0;">Sent at ${formattedTimestamp}</p>
          </div>
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
            <h2 style="color: #155724; margin-top: 0; font-size: 18px;">✅ Test Email Successful!</h2>
            <p style="color: #155724; margin-bottom: 0;">${customMessage}</p>
          </div>

          ${smtpDetailsHtml}

          <div style="margin-top: 24px; padding: 16px; background-color: #f8f9fa; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #495057; font-size: 16px;">Test Details</h3>
            <p style="margin: 8px 0; font-size: 14px;"><strong>Sent by:</strong> ${adminUserName} (${adminEmail})</p>
            <p style="margin: 8px 0; font-size: 14px;"><strong>Timestamp:</strong> ${formattedTimestamp}</p>
            <p style="margin: 8px 0; font-size: 14px;"><strong>Application:</strong> ${campName} Email System</p>
          </div>

          <div style="margin-top: 32px; text-align: center; color: #6c757d; font-size: 12px;">
            <p>This is an automated test email from ${campName}. If you received this unexpectedly, please contact your administrator.</p>
          </div>
        </div>
      `;

      const text = `
${subject}
Sent at ${formattedTimestamp}

✅ Test Email Successful!
${customMessage}

${includeSmtpDetails ? `
SMTP Configuration:
- Host: ${smtpHost}
- Port: ${smtpPort}
- SSL: ${smtpSecure ? 'Yes' : 'No'}
- Sender: ${senderName} <${senderEmail}>
` : ''}

Test Details:
- Sent by: ${adminUserName} (${adminEmail})
- Timestamp: ${formattedTimestamp}
- Application: ${campName} Email System

This is an automated test email from ${campName}. If you received this unexpectedly, please contact your administrator.
      `.trim();

      return { subject, html, text };
    } else {
      // Plain text format only
      const smtpDetailsText = includeSmtpDetails ? `

SMTP Configuration:
- Host: ${smtpHost}
- Port: ${smtpPort}
- SSL: ${smtpSecure ? 'Yes' : 'No'}
- Sender: ${senderName} <${senderEmail}>
` : '';

      const text = `
${subject}
Sent at ${formattedTimestamp}

✅ Test Email Successful!
${customMessage}
${smtpDetailsText}

Test Details:
- Sent by: ${adminUserName} (${adminEmail})
- Timestamp: ${formattedTimestamp}
- Application: ${campName} Email System

This is an automated test email from ${campName}. If you received this unexpectedly, please contact your administrator.
      `.trim();

      return { subject, html: text, text };
    }
  }
} 