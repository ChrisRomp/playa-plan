import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

/**
 * Service for sending emails through SendGrid or SMTP
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly defaultFrom: string;
  private readonly emailProvider: 'sendgrid' | 'smtp';
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.defaultFrom = this.configService.get<string>('email.defaultFrom') || 'noreply@example.com';
    this.emailProvider = this.configService.get<'sendgrid' | 'smtp'>('email.provider', 'sendgrid');

    if (this.emailProvider === 'sendgrid') {
      const sendgridApiKey = this.configService.get<string>('email.sendgrid.apiKey');
      if (sendgridApiKey) {
        sgMail.setApiKey(sendgridApiKey);
        this.logger.log('SendGrid email service initialized');
      } else {
        this.logger.warn('SendGrid API key not provided, email sending will be disabled');
      }
    } else if (this.emailProvider === 'smtp') {
      this.initSmtpTransporter();
    }
  }

  /**
   * Initialize SMTP transporter with configuration
   */
  private initSmtpTransporter(): void {
    const host = this.configService.get<string>('email.smtp.host');
    const port = this.configService.get<number>('email.smtp.port', 587);
    const user = this.configService.get<string>('email.smtp.user');
    const pass = this.configService.get<string>('email.smtp.password');

    if (!host || !user || !pass) {
      this.logger.warn('SMTP configuration incomplete, email sending will be disabled');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    this.logger.log('SMTP email service initialized');
  }

  /**
   * Send an email using the configured provider
   * @param options EmailOptions with recipient, subject, and content
   * @returns Promise resolving to true if email was sent
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const { to, subject, text, html, from, replyTo, attachments } = options;
      
      // Set default from if not provided
      const emailFrom = from || this.defaultFrom;
      
      if (this.emailProvider === 'sendgrid') {
        return this.sendViaSendGrid({
          to,
          from: emailFrom,
          subject,
          text: text || '',
          html,
          replyTo: replyTo || emailFrom,
          attachments: attachments?.map(att => ({
            filename: att.filename,
            content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
            type: att.contentType,
            disposition: 'attachment',
          })),
        });
      } else if (this.emailProvider === 'smtp' && this.transporter) {
        return this.sendViaSmtp({
          to,
          from: emailFrom,
          subject,
          text: text || '',
          html,
          replyTo: replyTo || emailFrom,
          attachments,
        });
      }
      
      this.logger.warn('No email provider configured or enabled');
      return false;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to send email: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Send email via SendGrid
   */
  private async sendViaSendGrid(mailOptions: sgMail.MailDataRequired): Promise<boolean> {
    try {
      await sgMail.send(mailOptions);
      this.logger.log(`Email sent via SendGrid to ${Array.isArray(mailOptions.to) ? mailOptions.to.join(', ') : mailOptions.to}`);
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`SendGrid email error: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Send email via SMTP
   */
  private async sendViaSmtp(mailOptions: nodemailer.SendMailOptions): Promise<boolean> {
    try {
      if (!this.transporter) {
        this.logger.error('SMTP transporter not initialized');
        return false;
      }
      
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent via SMTP to ${Array.isArray(mailOptions.to) ? mailOptions.to.join(', ') : mailOptions.to}`);
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`SMTP email error: ${err.message}`, err.stack);
      return false;
    }
  }
}