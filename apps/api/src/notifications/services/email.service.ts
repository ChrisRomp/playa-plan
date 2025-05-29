import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoreConfigService } from '../../core-config/services/core-config.service';
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

interface EmailConfiguration {
  emailEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpPassword: string | null;
  smtpUseSsl: boolean;
  senderEmail: string | null;
  senderName: string | null;
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
    private readonly coreConfigService: CoreConfigService
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
    try {
      const { to, subject, text, html, from, replyTo, attachments } = options;
      const isDebugMode = this.configService.get('NODE_ENV') === 'development';
      
      // Get current email configuration
      const config = await this.getEmailConfig();
      
      // In debug mode, always log the email content to console
      if (isDebugMode) {
        console.log('\n====== EMAIL CONTENT (DEBUG MODE) ======');
        console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Email Enabled: ${config.emailEnabled}`);
        console.log('\n----- Text Content -----');
        console.log(text || 'No text content provided');
        console.log('================================\n');
        
        // If email isn't enabled or configured, pretend it was sent successfully in debug mode
        if (!config.emailEnabled || !config.smtpHost) {
          this.logger.debug('Email disabled or not configured - simulating successful send in debug mode');
          return true;
        }
      }
      
      // If email is disabled globally, return false
      if (!config.emailEnabled) {
        this.logger.debug('Email sending disabled globally');
        return false;
      }
      
      // If SMTP not configured, return false
      if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
        this.logger.debug('SMTP not configured, skipping send');
        return false;
      }
      
      // Ensure SMTP transporter is initialized
      if (!this.transporter) {
        await this.initSmtpTransporter();
      }
      
      if (!this.transporter) {
        this.logger.warn('SMTP transporter failed to initialize');
        return false;
      }
      
      // Determine sender
      const defaultFrom = config.senderEmail 
        ? (config.senderName ? `${config.senderName} <${config.senderEmail}>` : config.senderEmail)
        : 'noreply@example.com';
      const emailFrom = from || defaultFrom;
      
      // Send via SMTP
      return this.sendViaSmtp({
        to,
        from: emailFrom,
        subject,
        text: text || '',
        html,
        replyTo: replyTo || emailFrom,
        attachments,
      });
      
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to send email: ${err.message}`, err.stack);
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