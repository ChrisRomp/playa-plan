import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService, EmailOptions } from './email.service';

export enum NotificationType {
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password_reset',
  EMAIL_VERIFICATION = 'email_verification',
  PAYMENT_CONFIRMATION = 'payment_confirmation',
  SHIFT_CONFIRMATION = 'shift_confirmation',
  LOGIN_CODE = 'login_code',
}

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
      };
      
      // Log notification to console in debug mode
      if (this.isDebugMode) {
        this.logNotificationToConsole(type, emailOptions);
      }
      
      // If no email provider is configured but we're in debug mode, return success
      // as the notification has been logged to console
      const emailProviderConfigured = this.configService.get<string>('email.provider') !== undefined;
      
      if (!emailProviderConfigured && this.isDebugMode) {
        return true;
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
   * Send welcome email to new user
   * @param email User email address
   * @param name User name
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    return this.sendNotification(email, NotificationType.WELCOME, { name });
  }

  /**
   * Send password reset email with token
   * @param email User email address
   * @param token Reset token
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetUrl = `${this.baseUrl}/reset-password?token=${token}`;
    return this.sendNotification(email, NotificationType.PASSWORD_RESET, { resetUrl });
  }

  /**
   * Send email verification email with token
   * @param email User email address
   * @param token Verification token
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendEmailVerificationEmail(email: string, token: string): Promise<boolean> {
    const verificationUrl = `${this.baseUrl}/verify-email?token=${token}`;
    return this.sendNotification(email, NotificationType.EMAIL_VERIFICATION, { verificationUrl });
  }

  /**
   * Send payment confirmation email
   * @param email User email address
   * @param paymentDetails Payment details
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendPaymentConfirmationEmail(
    email: string, 
    paymentDetails: { 
      id: string; 
      amount: number; 
      currency: string; 
      date: Date;
    }
  ): Promise<boolean> {
    return this.sendNotification(email, NotificationType.PAYMENT_CONFIRMATION, { paymentDetails });
  }

  /**
   * Send shift confirmation email
   * @param email User email address
   * @param shiftDetails Shift details
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendShiftConfirmationEmail(
    email: string,
    shiftDetails: {
      id: string;
      jobName: string;
      date: Date;
      startTime: string;
      endTime: string;
      location: string;
    }
  ): Promise<boolean> {
    return this.sendNotification(email, NotificationType.SHIFT_CONFIRMATION, { shiftDetails });
  }

  /**
   * Send login verification code email
   * @param email User email address
   * @param code Verification code
   * @returns Promise resolving to true if email was sent successfully
   */
  async sendLoginCodeEmail(email: string, code: string): Promise<boolean> {
    return this.sendNotification(email, NotificationType.LOGIN_CODE, { loginCode: code });
  }

  /**
   * Get template for specific notification type
   * @param type Notification type
   * @param data Template data
   * @returns Prepared template with subject, text and HTML content
   */
  private getNotificationTemplate(type: NotificationType, data: TemplateData): NotificationTemplate {
    switch (type) {
      case NotificationType.WELCOME:
        return this.getWelcomeTemplate(data.name || '');
      case NotificationType.PASSWORD_RESET:
        return this.getPasswordResetTemplate(data.resetUrl || '');
      case NotificationType.EMAIL_VERIFICATION:
        return this.getEmailVerificationTemplate(data.verificationUrl || '');
      case NotificationType.LOGIN_CODE:
        return this.getLoginCodeTemplate(data.loginCode || '');
      case NotificationType.PAYMENT_CONFIRMATION:
        if (!data.paymentDetails) {
          throw new Error('Payment details are required for payment confirmation template');
        }
        return this.getPaymentConfirmationTemplate(data.paymentDetails);
      case NotificationType.SHIFT_CONFIRMATION:
        if (!data.shiftDetails) {
          throw new Error('Shift details are required for shift confirmation template');
        }
        return this.getShiftConfirmationTemplate(data.shiftDetails);
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
   * Get shift confirmation template
   */
  private getShiftConfirmationTemplate(shiftDetails: { id: string; jobName: string; date: Date; startTime: string; endTime: string; location: string }): NotificationTemplate {
    const { id, jobName, date, startTime, endTime, location } = shiftDetails;
    const formattedDate = new Date(date).toLocaleDateString();
    
    const subject = 'Shift Confirmation';
    const text = `
      Hi there,
      
      Your shift has been confirmed:
      
      Job: ${jobName}
      Date: ${formattedDate}
      Time: ${startTime} - ${endTime}
      Location: ${location}
      Shift ID: ${id}
      
      Thank you for volunteering!
      
      Best regards,
      The PlayaPlan Team
    `;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Shift Confirmation</h2>
        <p>Hi there,</p>
        <p>Your shift has been confirmed:</p>
        <p style="background-color: #f5f5f5; padding: 15px; border-radius: 4px;">
          <strong>Job:</strong> ${jobName}<br>
          <strong>Date:</strong> ${formattedDate}<br>
          <strong>Time:</strong> ${startTime} - ${endTime}<br>
          <strong>Location:</strong> ${location}<br>
          <strong>Shift ID:</strong> ${id}
        </p>
        <p>Thank you for volunteering!</p>
        <p>Best regards,<br>The PlayaPlan Team</p>
      </div>
    `;
    
    return { subject, text, html };
  }
} 