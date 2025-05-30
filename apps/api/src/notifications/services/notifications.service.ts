import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService, EmailOptions } from './email.service';
import { NotificationType } from '@prisma/client';

export interface NotificationTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface TemplateData {
  name?: string;
  resetUrl?: string;
  verificationUrl?: string;
  loginCode?: string;
  oldEmail?: string;
  newEmail?: string;
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
  ) {
    this.baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3000');
    this.isDebugMode = this.configService.get<string>('nodeEnv') === 'development' || 
                        process.argv.includes('--debug');
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
      const template = this.getNotificationTemplate(type, data);
      
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
    userId: string
  ): Promise<boolean> {
    return this.sendNotification(email, NotificationType.REGISTRATION_CONFIRMATION, { 
      registrationDetails, 
      userId 
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
   * Get template for specific notification type
   * @param type Notification type
   * @param data Template data
   * @returns Prepared template with subject, text and HTML content
   */
  private getNotificationTemplate(type: NotificationType, data: TemplateData): NotificationTemplate {
    switch (type) {
      case NotificationType.PASSWORD_RESET:
        return this.getPasswordResetTemplate(data.resetUrl || '');
      case NotificationType.EMAIL_VERIFICATION:
        return this.getEmailVerificationTemplate(data.verificationUrl || '');
      case NotificationType.EMAIL_AUTHENTICATION:
        return this.getLoginCodeTemplate(data.loginCode || '');
      case NotificationType.EMAIL_CHANGE:
        return this.getEmailChangeTemplate(
          data.oldEmail || '', 
          data.newEmail || '', 
          Boolean(data.isToOldEmail)
        );
      case NotificationType.PAYMENT_CONFIRMATION:
        if (!data.paymentDetails) {
          throw new Error('Payment details are required for payment confirmation template');
        }
        return this.getPaymentConfirmationTemplate(data.paymentDetails);
      case NotificationType.REGISTRATION_CONFIRMATION:
        if (!data.registrationDetails) {
          throw new Error('Registration details are required for registration confirmation template');
        }
        return this.getRegistrationConfirmationTemplate(data.registrationDetails);
      case NotificationType.REGISTRATION_ERROR:
        if (!data.errorDetails) {
          throw new Error('Error details are required for registration error template');
        }
        return this.getRegistrationErrorTemplate(data.errorDetails);
      case NotificationType.SHIFT_REMINDER:
        if (!data.shiftDetails) {
          throw new Error('Shift details are required for shift reminder template');
        }
        return this.getShiftReminderTemplate(data.shiftDetails);
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
  }

  /**
   * Get welcome email template
   */
  private getWelcomeTemplate(name: string): NotificationTemplate {
    const subject = 'Welcome to PlayaPlan!';
    const text = `
      Hi ${name},
      
      Welcome to PlayaPlan! We're excited to have you on board.
      
      You can now sign in to your account and start exploring our services.
      
      Best regards,
      The PlayaPlan Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to PlayaPlan!</h2>
        <p>Hi ${name},</p>
        <p>Welcome to PlayaPlan! We're excited to have you on board.</p>
        <p>You can now sign in to your account and start exploring our services.</p>
        <p>Best regards,<br>The PlayaPlan Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get password reset email template
   */
  private getPasswordResetTemplate(resetUrl: string): NotificationTemplate {
    const subject = 'Reset Your PlayaPlan Password';
    const text = `
      Hi there,
      
      You've requested to reset your password. Click the link below to set a new password:
      
      ${resetUrl}
      
      This link will expire in 1 hour. If you didn't request this, please ignore this email.
      
      Best regards,
      The PlayaPlan Team
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
        <p>Best regards,<br>The PlayaPlan Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get email verification template
   */
  private getEmailVerificationTemplate(verificationUrl: string): NotificationTemplate {
    const subject = 'Verify Your PlayaPlan Email';
    const text = `
      Hi there,
      
      Please verify your email address by clicking the link below:
      
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      Best regards,
      The PlayaPlan Team
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
        <p>Best regards,<br>The PlayaPlan Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get login code email template
   */
  private getLoginCodeTemplate(code: string): NotificationTemplate {
    const subject = 'Your PlayaPlan Login Code';
    const text = `
      Hello,
      
      Your verification code to log in to PlayaPlan is: ${code}
      
      This code will expire in 15 minutes. If you did not request this code, please ignore this email.
      
      Best regards,
      The PlayaPlan Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Login Verification Code</h2>
        <p>Hello,</p>
        <p>Your verification code to log in to PlayaPlan is:</p>
        <div style="background-color: #f5f5f5; padding: 15px; font-size: 24px; text-align: center; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
          ${code}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request this code, please ignore this email.</p>
        <p>Best regards,<br>The PlayaPlan Team</p>
      </div>
    `;
    return { subject, text, html };
  }

  /**
   * Get payment confirmation template
   */
  private getPaymentConfirmationTemplate(paymentDetails: { id: string; amount: number; currency: string; date: Date }): NotificationTemplate {
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
      The PlayaPlan Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Confirmation</h2>
        <p>Hi there,</p>
        <p>We've received your payment of ${formattedAmount} on ${formattedDate}.</p>
        <p><strong>Payment ID:</strong> ${id}</p>
        <p>Thank you for your payment!</p>
        <p>Best regards,<br>The PlayaPlan Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }

  /**
   * Get email change template
   */
  private getEmailChangeTemplate(oldEmail: string, newEmail: string, isToOldEmail: boolean): NotificationTemplate {
    const subject = isToOldEmail ? 'Email Change Notification' : 'Email Change Confirmation';
    const text = `
      Hi there,
      
      Your email address has been changed.
      
      Old Email: ${oldEmail}
      New Email: ${newEmail}
      
      If you did not request this change, please contact support immediately.
      
      Best regards,
      The PlayaPlan Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>Hi there,</p>
        <p>Your email address has been changed.</p>
        <p><strong>Old Email:</strong> ${oldEmail}</p>
        <p><strong>New Email:</strong> ${newEmail}</p>
        <p>If you did not request this change, please contact support immediately.</p>
        <p>Best regards,<br>The PlayaPlan Team</p>
      </div>
    `;
    
    return { subject, text, html };
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
  }): NotificationTemplate {
    const { id, year, status, campingOptions, jobs, totalCost, currency } = registrationDetails;
    const formattedDate = new Date(year, 0, 1).toLocaleDateString();
    const formattedAmount = totalCost ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(totalCost / 100) : 'N/A';
    
    const subject = 'Registration Confirmation';
    const text = `
      Hi there,
      
      Your registration has been confirmed.
      
      Registration ID: ${id}
      Status: ${status}
      Date: ${formattedDate}
      Total Cost: ${formattedAmount}
      
      Camping Options:
      ${campingOptions ? campingOptions.map(option => `- ${option.name} (${option.description})`).join('\n') : 'N/A'}
      
      Jobs:
      ${jobs ? jobs.map(job => `- ${job.name} (${job.category}, ${job.shift.name} - ${job.shift.endTime})`).join('\n') : 'N/A'}
      
      Thank you for registering with PlayaPlan!
      
      Best regards,
      The PlayaPlan Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>Hi there,</p>
        <p>Your registration has been confirmed.</p>
        <p><strong>Registration ID:</strong> ${id}</p>
        <p><strong>Status:</strong> ${status}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Total Cost:</strong> ${formattedAmount}</p>
        <p><strong>Camping Options:</strong></p>
        <ul>
          ${campingOptions ? campingOptions.map(option => `<li>- ${option.name} (${option.description})</li>`).join('') : '<li>N/A</li>'}
        </ul>
        <p><strong>Jobs:</strong></p>
        <ul>
          ${jobs ? jobs.map(job => `<li>- ${job.name} (${job.category}, ${job.shift.name} - ${job.shift.endTime})</li>`).join('') : '<li>N/A</li>'}
        </ul>
        <p>Thank you for registering with PlayaPlan!</p>
        <p>Best regards,<br>The PlayaPlan Team</p>
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
  }): NotificationTemplate {
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
      The PlayaPlan Team
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
        <p>Best regards,<br>The PlayaPlan Team</p>
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
  }): NotificationTemplate {
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
      The PlayaPlan Team
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
        <p>Best regards,<br>The PlayaPlan Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }
} 