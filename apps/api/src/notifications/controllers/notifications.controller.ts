import { Body, Controller, Post, Get, Query, UseGuards, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from '../services/notifications.service';
import { EmailService } from '../services/email.service';
import { EmailAuditService } from '../services/email-audit.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SendEmailDto, SendEmailToMultipleRecipientsDto, SendTestEmailDto } from '../dto/send-email.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, NotificationType } from '@prisma/client';

/**
 * Type definition for authenticated request
 */
interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
}

/**
 * Controller for managing notifications and email sending
 */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly emailAuditService: EmailAuditService,
    private readonly coreConfigService: CoreConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Send an email to a single recipient (admin only)
   */
  @Post('email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send email to a single recipient' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email sent successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden - requires admin role' })
  async sendEmail(@Body() sendEmailDto: SendEmailDto): Promise<{ success: boolean }> {
    const result = await this.emailService.sendEmail({
      to: sendEmailDto.to,
      subject: sendEmailDto.subject,
      html: sendEmailDto.html,
      text: sendEmailDto.text,
      notificationType: sendEmailDto.notificationType || NotificationType.EMAIL_VERIFICATION,
      attachments: sendEmailDto.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    });

    return { success: result };
  }

  /**
   * Send an email to multiple recipients (admin only)
   */
  @Post('email/batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send email to multiple recipients' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email sent successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden - requires admin role' })
  async sendEmailToMultipleRecipients(
    @Body() dto: SendEmailToMultipleRecipientsDto,
  ): Promise<{ success: boolean }> {
    const result = await this.emailService.sendEmail({
      to: dto.to,
      subject: dto.subject,
      html: dto.html,
      text: dto.text,
      notificationType: dto.notificationType || NotificationType.EMAIL_VERIFICATION,
      attachments: dto.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    });

    return { success: result };
  }

  /**
   * Send a test email to the provided address (admin only)
   */
  @Post('email/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a test email' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Test email sent successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden - requires admin role' })
  async sendTestEmail(
    @Body() testEmailDto: SendTestEmailDto,
    @Request() req: AuthRequest
  ): Promise<{
    success: boolean;
    message: string;
    auditRecordId?: string;
    timestamp: string;
    recipients?: string[];
    smtpConfiguration?: {
      host: string;
      port: number;
      secure: boolean;
      senderEmail: string;
      senderName: string;
    };
    emailPreview?: {
      subject: string;
      format: string;
      includeSmtpDetails: boolean;
    };
  }> {
    try {
      // Get current email configuration
      const emailConfig = await this.coreConfigService.getEmailConfiguration();
      
      // Get camp configuration for dynamic camp name
      const campConfig = await this.coreConfigService.findCurrent(false);
      const campName = campConfig?.campName || 'PlayaPlan';
      
      // Check if email is enabled
      if (!emailConfig.emailEnabled) {
        throw new Error('Email notifications are currently disabled. Please enable email notifications first.');
      }

      // Check if SMTP is properly configured
      if (!emailConfig.smtpHost || !emailConfig.senderEmail) {
        throw new Error('SMTP configuration is incomplete. Please configure SMTP settings before sending test emails.');
      }

      const timestamp = new Date();
      const user = req.user;
      const recipients = testEmailDto.email.split(',').map(e => e.trim()).filter(e => e.length > 0);

      // Send test email using the service
      const testEmailDetails = {
        smtpHost: emailConfig.smtpHost,
        smtpPort: emailConfig.smtpPort || 587,
        smtpSecure: emailConfig.smtpUseSsl || false,
        senderEmail: emailConfig.senderEmail,
        senderName: emailConfig.senderName || campName,
        adminUserName: `${user.firstName} ${user.lastName}`,
        adminEmail: user.email,
        timestamp,
      };

      const customContent = {
        subject: testEmailDto.subject || `Test Email from ${campName}`,
        message: testEmailDto.message,
        format: testEmailDto.format,
        includeSmtpDetails: testEmailDto.includeSmtpDetails,
      };

      const success = await this.notificationsService.sendTestEmail(
        testEmailDto.email,
        testEmailDetails,
        user.id,
        customContent
      );

      if (success) {
        return {
          success: true,
          message: `Test email sent successfully to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}!`,
          timestamp: timestamp.toISOString(),
          recipients,
          smtpConfiguration: {
            host: emailConfig.smtpHost,
            port: emailConfig.smtpPort || 587,
            secure: emailConfig.smtpUseSsl,
            senderEmail: emailConfig.senderEmail,
            senderName: emailConfig.senderName || campName,
          },
          emailPreview: {
            subject: testEmailDto.subject || `Test Email from ${campName}`,
            format: testEmailDto.format || 'html',
            includeSmtpDetails: testEmailDto.includeSmtpDetails !== false,
          },
        };
      } else {
        const recipients = testEmailDto.email.split(',').map(e => e.trim()).filter(e => e.length > 0);
        
        return {
          success: false,
          message: 'Failed to send test email. Please check your SMTP configuration and try again.',
          timestamp: timestamp.toISOString(),
          recipients,
          smtpConfiguration: {
            host: emailConfig.smtpHost,
            port: emailConfig.smtpPort || 587,
            secure: emailConfig.smtpUseSsl,
            senderEmail: emailConfig.senderEmail,
            senderName: emailConfig.senderName || campName,
          },
          emailPreview: {
            subject: testEmailDto.subject || `Test Email from ${campName}`,
            format: testEmailDto.format || 'html',
            includeSmtpDetails: testEmailDto.includeSmtpDetails !== false,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error sending test email: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get email audit statistics (admin only)
   */
  @Get('email/statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get email audit statistics' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for statistics (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for statistics (ISO string)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email statistics retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden - requires admin role' })
  async getEmailStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<{
    totalEmails: number;
    sentEmails: number;
    failedEmails: number;
    disabledEmails: number;
    byNotificationType: Record<string, number>;
  }> {
    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return await this.emailAuditService.getEmailStatistics(start, end);
  }

  /**
   * Get recent test email history (admin only)
   */
  @Get('email/test/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recent test email history' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of records to return (default 10, max 50)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Test email history retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden - requires admin role' })
  async getTestEmailHistory(
    @Query('limit') limitStr?: string,
  ): Promise<{
    testEmails: Array<{
      id: string;
      recipientEmail: string;
      subject: string;
      status: string;
      errorMessage?: string;
      sentAt?: string;
      createdAt: string;
      userId?: string;
    }>;
    total: number;
  }> {
    const limit = Math.min(parseInt(limitStr || '10', 10), 50);
    
    try {
      const testEmails = await this.prismaService.emailAudit.findMany({
        where: {
          notificationType: NotificationType.EMAIL_TEST,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          id: true,
          recipientEmail: true,
          subject: true,
          status: true,
          errorMessage: true,
          sentAt: true,
          createdAt: true,
          userId: true,
        },
      });

      const total = await this.prismaService.emailAudit.count({
        where: {
          notificationType: NotificationType.EMAIL_TEST,
        },
      });

      return {
        testEmails: testEmails.map(email => ({
          id: email.id,
          recipientEmail: email.recipientEmail,
          subject: email.subject,
          status: email.status.toString(),
          errorMessage: email.errorMessage || undefined,
          sentAt: email.sentAt?.toISOString(),
          createdAt: email.createdAt.toISOString(),
          userId: email.userId || undefined,
        })),
        total,
      };
    } catch (error) {
      throw new Error(`Failed to retrieve test email history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test SMTP connection without sending email (admin only)
   */
  @Post('email/test-connection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test SMTP connection without sending email' })
  @ApiResponse({ status: HttpStatus.OK, description: 'SMTP connection test completed' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden - requires admin role' })
  async testSmtpConnection(): Promise<{
    success: boolean;
    message: string;
    details?: {
      host: string;
      port: number;
      secure: boolean;
      authenticated: boolean;
      connectionTime?: number;
    };
    errorDetails?: {
      code?: string;
      errno?: number;
      address?: string;
      port?: number;
      response?: string;
    };
  }> {
    try {
      // Get current email configuration
      const emailConfig = await this.coreConfigService.getEmailConfiguration();
      
      // Check if email is enabled
      if (!emailConfig.emailEnabled) {
        return {
          success: false,
          message: 'Email notifications are currently disabled. Please enable email notifications first.',
        };
      }

      // Check if SMTP is properly configured
      if (!emailConfig.smtpHost || !emailConfig.smtpUsername || !emailConfig.smtpPassword || !emailConfig.senderEmail) {
        return {
          success: false,
          message: 'SMTP configuration is incomplete. Please ensure all SMTP settings are configured.',
          details: {
            host: emailConfig.smtpHost || '',
            port: emailConfig.smtpPort || 587,
            secure: emailConfig.smtpUseSsl,
            authenticated: false,
          },
        };
      }

      // Test the SMTP connection
      const startTime = Date.now();
      const result = await this.emailService.testSmtpConnection();
      const connectionTime = Date.now() - startTime;

      if (result.success) {
        return {
          success: true,
          message: 'SMTP connection successful! Your email configuration is working correctly.',
          details: {
            host: emailConfig.smtpHost,
            port: emailConfig.smtpPort || 587,
            secure: emailConfig.smtpUseSsl,
            authenticated: true,
            connectionTime,
          },
        };
      } else {
        return {
          success: false,
          message: result.message || 'SMTP connection failed. Please check your configuration.',
          details: {
            host: emailConfig.smtpHost,
            port: emailConfig.smtpPort || 587,
            secure: emailConfig.smtpUseSsl,
            authenticated: false,
            connectionTime,
          },
          errorDetails: result.errorDetails,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error testing SMTP connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
} 