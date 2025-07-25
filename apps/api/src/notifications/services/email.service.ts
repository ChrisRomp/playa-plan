import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { EmailAuditService } from './email-audit.service';
import { NotificationType } from '@prisma/client';
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
  // Audit trail fields
  notificationType: NotificationType;
  userId?: string;
  ccEmails?: string[];
  bccEmails?: string[];
}

interface EmailConfiguration {
  emailEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpPassword: string | null;
  smtpUseSsl: boolean;
  senderEmail: string | null;
  senderName: string | null;
  replyToEmail: string | null;
}

/**
 * Service for sending emails through SMTP
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private configCache: EmailConfiguration | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

  constructor(
    private readonly configService: ConfigService,
    private readonly coreConfigService: CoreConfigService,
    private readonly emailAuditService: EmailAuditService
  ) {
    // ConfigService is only kept for NODE_ENV checking
    // Email configuration now comes from database via CoreConfigService with caching
  }

  /**
   * Initialize service when module starts
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing EmailService with database configuration...');
      await this.refreshConfiguration();
      this.logger.log('EmailService initialization completed');
    } catch (error) {
      this.logger.error('Failed to initialize EmailService', error);
      // Don't throw - service should still be available even if initial config fails
    }
  }

  /**
   * Get email configuration with caching
   * @param forceRefresh - Force refresh the cache
   */
  private async getEmailConfig(forceRefresh = false): Promise<EmailConfiguration> {
    const now = Date.now();
    
    // Return cached config if valid and not forcing refresh
    if (!forceRefresh && this.configCache && now < this.cacheExpiry) {
      return this.configCache;
    }

    try {
      // Fetch fresh configuration from database
      this.configCache = await this.coreConfigService.getEmailConfiguration();
      this.cacheExpiry = now + this.CACHE_TTL_MS;
      
      this.logger.debug('Email configuration refreshed from database');
      return this.configCache;
    } catch (error) {
      this.logger.error('Failed to refresh email configuration from database', error);
      
      // Return cached config if available, otherwise return disabled state
      if (this.configCache) {
        this.logger.warn('Using stale email configuration cache due to database error');
        return this.configCache;
      }
      
      // Return safe defaults
      const fallbackConfig: EmailConfiguration = {
        emailEnabled: false,
        smtpHost: null,
        smtpPort: null,
        smtpUsername: null,
        smtpPassword: null,
        smtpUseSsl: false,
        senderEmail: null,
        senderName: null,
        replyToEmail: null,
      };
      
      this.configCache = fallbackConfig;
      this.cacheExpiry = now + this.CACHE_TTL_MS;
      return fallbackConfig;
    }
  }

  /**
   * Initialize or refresh SMTP transporter with current configuration
   */
  private async initSmtpTransporter(): Promise<void> {
    const config = await this.getEmailConfig();

    if (!config.emailEnabled || !config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
      this.transporter = null;
      this.logger.debug('SMTP transporter disabled - email configuration incomplete or disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpUseSsl,
        auth: {
          user: config.smtpUsername,
          pass: config.smtpPassword,
        },
        // Add connection timeout settings to prevent hanging
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000,   // 5 seconds
        socketTimeout: 30000,    // 30 seconds
      });

      this.logger.log(`SMTP email service initialized for ${config.smtpHost}:${config.smtpPort || 587}`);
    } catch (error) {
      this.logger.error('Failed to initialize SMTP transporter', error);
      this.transporter = null;
    }
  }

  /**
   * Force refresh of email configuration cache
   */
  async refreshConfiguration(): Promise<void> {
    await this.getEmailConfig(true);
    await this.initSmtpTransporter();
  }

  /**
   * Send an email using SMTP
   * @param options EmailOptions with recipient, subject, and content
   * @returns Promise resolving to true if email was sent
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    const {
      to,
      subject,
      text,
      html,
      from,
      replyTo,
      attachments,
      notificationType,
      userId,
      ccEmails,
      bccEmails
    } = options;

    // Validate required fields
    if (!notificationType) {
      this.logger.error('EmailService.sendEmail called without required notificationType field');
      return false;
    }

    // Get primary recipient for logging (use first if array)
    const primaryRecipient = Array.isArray(to) ? to[0] : to;
    const isDebugMode = this.configService.get('NODE_ENV') === 'development';

    try {
      // Get current email configuration
      const config = await this.getEmailConfig();
      
      // In debug mode, always log the email content to console
      if (isDebugMode) {
        console.log('\n====== EMAIL CONTENT (DEBUG MODE) ======');
        console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Email Enabled: ${config.emailEnabled}`);
        console.log(`Notification Type: ${notificationType}`);
        console.log('\n----- Text Content -----');
        console.log(text || 'No text content provided');
        console.log('================================\n');
      }
      
      // If email is disabled globally, log as disabled and return false
      if (!config.emailEnabled) {
        await this.emailAuditService.logEmailDisabled(
          primaryRecipient,
          subject,
          notificationType,
          userId,
          ccEmails,
          bccEmails
        );
        
        this.logger.debug('Email sending disabled globally');
        
        // In debug mode, pretend it was sent successfully even when disabled
        return isDebugMode;
      }
      
      // If SMTP not configured, log as failed and return false
      if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
        await this.emailAuditService.logEmailFailed(
          primaryRecipient,
          subject,
          notificationType,
          'SMTP configuration incomplete',
          userId,
          ccEmails,
          bccEmails
        );
        
        this.logger.debug('SMTP not configured, skipping send');
        
        // In debug mode, pretend it was sent successfully even when not configured
        return isDebugMode;
      }
      
      // Ensure SMTP transporter is initialized
      if (!this.transporter) {
        await this.initSmtpTransporter();
      }
      
      if (!this.transporter) {
        const errorMessage = 'SMTP transporter failed to initialize';
        
        await this.emailAuditService.logEmailFailed(
          primaryRecipient,
          subject,
          notificationType,
          errorMessage,
          userId,
          ccEmails,
          bccEmails
        );
        
        this.logger.warn(errorMessage);
        return false;
      }
      
      // Determine sender
      const defaultFrom = config.senderEmail 
        ? (config.senderName ? `${config.senderName} <${config.senderEmail}>` : config.senderEmail)
        : 'noreply@example.com';
      const emailFrom = from || defaultFrom;
      
      // Determine reply-to address
      const defaultReplyTo = config.replyToEmail || emailFrom;
      const emailReplyTo = replyTo || defaultReplyTo;
      
      // Enhanced debug mode: Show all email parameters that will be sent
      if (isDebugMode) {
        this.logger.debug('====== DEBUG: EMAIL PARAMETERS ======');
        console.log(`From: ${emailFrom}`);
        console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
        if (ccEmails && ccEmails.length > 0) console.log(`CC: ${ccEmails.join(', ')}`);
        if (bccEmails && bccEmails.length > 0) console.log(`BCC: ${bccEmails.join(', ')}`);
        console.log(`Subject: ${subject}`);
        console.log(`Reply-To: ${emailReplyTo}`);
        console.log('\n--- SMTP Configuration ---');
        console.log(`Host: ${config.smtpHost}`);
        console.log(`Port: ${config.smtpPort}`);
        console.log(`Username: ${config.smtpUsername}`);
        console.log(`Secure: ${config.smtpUseSsl}`);
        console.log(`Sender Email Config: ${config.senderEmail}`);
        console.log(`Sender Name Config: ${config.senderName}`);
        console.log(`Reply-To Email Config: ${config.replyToEmail}`);
        console.log('=============================================\n');
      }
      
      // Attempt to send via SMTP
      const emailSent = await this.sendViaSmtp({
        to,
        from: emailFrom,
        subject,
        text: text || '',
        html,
        replyTo: emailReplyTo,
        attachments,
        cc: ccEmails,
        bcc: bccEmails,
      });
      
      // Log the result
      if (emailSent) {
        await this.emailAuditService.logEmailSent(
          primaryRecipient,
          subject,
          notificationType,
          userId,
          ccEmails,
          bccEmails
        );
      } else {
        await this.emailAuditService.logEmailFailed(
          primaryRecipient,
          subject,
          notificationType,
          'SMTP send operation returned false',
          userId,
          ccEmails,
          bccEmails
        );
      }
      
      return emailSent;
      
    } catch (error: unknown) {
      const err = error as Error;
      const errorMessage = `Failed to send email: ${err.message}`;
      
      // Log the failure
      await this.emailAuditService.logEmailFailed(
        primaryRecipient,
        subject,
        notificationType,
        errorMessage,
        userId,
        ccEmails,
        bccEmails
      );
      
      this.logger.error(errorMessage, err.stack);
      return false;
    }
  }

  /**
   * Send email via SMTP with timeout protection
   */
  private async sendViaSmtp(mailOptions: nodemailer.SendMailOptions): Promise<boolean> {
    try {
      if (!this.transporter) {
        this.logger.error('SMTP transporter not initialized');
        return false;
      }
      
      // Create a timeout promise to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000);
      });
      
      // Race between sending email and timeout
      await Promise.race([
        this.transporter.sendMail(mailOptions),
        timeoutPromise
      ]);
      
      this.logger.log(`Email sent via SMTP to ${Array.isArray(mailOptions.to) ? mailOptions.to.join(', ') : mailOptions.to}`);
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      
      // Enhanced error logging with mail options
      this.logger.error(`SMTP email error: ${err.message}`);
      this.logger.error(`Failed mail options:`, {
        from: mailOptions.from,
        to: mailOptions.to,
        cc: mailOptions.cc,
        bcc: mailOptions.bcc,
        subject: mailOptions.subject,
        replyTo: mailOptions.replyTo,
      });
      
      return false;
    }
  }

  /**
   * Merges database configuration with form override, treating empty strings as not provided
   * @param dbConfig Database configuration
   * @param override Form configuration that may contain empty strings
   * @returns Merged configuration with fallback to database values for empty strings
   */
  private mergeEmailConfiguration(dbConfig: EmailConfiguration, override: Partial<EmailConfiguration>): EmailConfiguration {
    const result = { ...dbConfig };
    
    // For each override property, only use it if it's not null, undefined, or empty string
    Object.keys(override).forEach(key => {
      const typedKey = key as keyof EmailConfiguration;
      const value = override[typedKey];
      if (value !== null && value !== undefined && value !== '') {
        // Type-safe assignment based on the property key
        switch (typedKey) {
          case 'emailEnabled':
            result.emailEnabled = value as boolean;
            break;
          case 'smtpHost':
            result.smtpHost = value as string;
            break;
          case 'smtpPort':
            result.smtpPort = value as number;
            break;
          case 'smtpUsername':
            result.smtpUsername = value as string;
            break;
          case 'smtpPassword':
            result.smtpPassword = value as string;
            break;
          case 'smtpUseSsl':
            result.smtpUseSsl = value as boolean;
            break;
          case 'senderEmail':
            result.senderEmail = value as string;
            break;
          case 'senderName':
            result.senderName = value as string;
            break;
          case 'replyToEmail':
            result.replyToEmail = value as string;
            break;
        }
      }
    });
    
    return result;
  }

  /**
   * Test SMTP connection without sending an email
   * @param configOverride Optional configuration to use instead of database config
   * @returns Promise with connection test result
   */
  async testSmtpConnection(configOverride?: Partial<EmailConfiguration>): Promise<{
    success: boolean;
    message: string;
    errorDetails?: {
      code?: string;
      errno?: number;
      address?: string;
      port?: number;
      response?: string;
    };
  }> {
    try {
      // Get current configuration or use override
      const dbConfig = await this.getEmailConfig();
      const config = configOverride ? this.mergeEmailConfiguration(dbConfig, configOverride) : dbConfig;
      
      if (!config.emailEnabled) {
        return {
          success: false,
          message: 'Email notifications are disabled',
        };
      }

      if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
        return {
          success: false,
          message: 'SMTP configuration is incomplete',
        };
      }

      // Create a temporary transporter for testing
      const testTransporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpUseSsl,
        auth: {
          user: config.smtpUsername,
          pass: config.smtpPassword,
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000,    // 5 seconds
        socketTimeout: 10000,     // 10 seconds
      });

      // Test the connection with timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('SMTP connection test timeout after 15 seconds')), 15000);
      });
      
      await Promise.race([
        testTransporter.verify(),
        timeoutPromise
      ]);
      
      return {
        success: true,
        message: 'SMTP connection verified successfully',
      };
    } catch (error: unknown) {
      const err = error as Error & {
        code?: string;
        errno?: number;
        address?: string;
        port?: number;
        response?: string;
        responseCode?: number;
      };

      let message = 'SMTP connection failed';
      const errorDetails: {
        code?: string;
        errno?: number;
        address?: string;
        port?: number;
        response?: string;
      } = {};

      // Extract detailed error information
      if (err.code) {
        errorDetails.code = err.code;
        
        switch (err.code) {
          case 'ECONNREFUSED':
            message = 'Connection refused. Check SMTP host and port.';
            break;
          case 'ENOTFOUND':
            message = 'SMTP host not found. Check the hostname.';
            break;
          case 'ETIMEDOUT':
            message = 'Connection timed out. Check host and firewall settings.';
            break;
          case 'EAUTH':
            message = 'Authentication failed. Check username and password.';
            break;
          case 'ESOCKET':
            message = 'Socket error. Check network connectivity.';
            break;
          default:
            message = `SMTP error: ${err.code}`;
        }
      } else if (err.responseCode === 535) {
        message = 'Authentication failed. Check username and password.';
      } else if (err.response) {
        message = `SMTP server error: ${err.response}`;
        errorDetails.response = err.response;
      }

      if (err.errno) errorDetails.errno = err.errno;
      if (err.address) errorDetails.address = err.address;
      if (err.port) errorDetails.port = err.port;

      this.logger.error(`SMTP connection test failed: ${err.message}`, err.stack);

      return {
        success: false,
        message,
        errorDetails,
      };
    }
  }
}