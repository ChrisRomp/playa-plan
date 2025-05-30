import { Body, Controller, Post, Get, Query, UseGuards, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from '../services/notifications.service';
import { EmailService } from '../services/email.service';
import { EmailAuditService } from '../services/email-audit.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SendEmailDto, SendEmailToMultipleRecipientsDto } from '../dto/send-email.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, NotificationType, EmailAuditStatus } from '@prisma/client';

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
      notificationType: NotificationType.EMAIL_VERIFICATION,
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
      notificationType: NotificationType.EMAIL_VERIFICATION,
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
    @Body('email') email: string,
    @Request() req: AuthRequest
  ): Promise<{
    success: boolean;
    message: string;
    auditRecordId?: string;
    timestamp: string;
    smtpConfiguration?: {
      host: string;
      port: number;
      secure: boolean;
      senderEmail: string;
      senderName: string;
    };
  }> {
    try {
      // Get current email configuration
      const emailConfig = await this.coreConfigService.getEmailConfiguration();
      
      // Check if email is enabled
      if (!emailConfig.emailEnabled) {
        return {
          success: false,
          message: 'Email sending is currently disabled. Please enable email in the configuration first.',
          timestamp: new Date().toISOString(),
        };
      }

      // Check if SMTP is properly configured
      if (!emailConfig.smtpHost || !emailConfig.smtpUsername || !emailConfig.smtpPassword || !emailConfig.senderEmail) {
        return {
          success: false,
          message: 'SMTP configuration is incomplete. Please configure SMTP settings before sending test emails.',
          timestamp: new Date().toISOString(),
        };
      }

      const timestamp = new Date();
      const adminUserName = `${req.user.firstName} ${req.user.lastName}`;

      // Prepare test email details
      const testEmailDetails = {
        smtpHost: emailConfig.smtpHost,
        smtpPort: emailConfig.smtpPort || 587,
        smtpSecure: emailConfig.smtpUseSsl,
        senderEmail: emailConfig.senderEmail,
        senderName: emailConfig.senderName || 'PlayaPlan',
        adminUserName,
        adminEmail: req.user.email,
        timestamp,
      };

      // Send the test email
      const result = await this.notificationsService.sendTestEmail(
        email,
        testEmailDetails,
        req.user.id
      );

      if (result) {
        // Get the latest audit record for this test email
        const auditRecords = await this.prismaService.emailAudit.findMany({
          where: {
            recipientEmail: email,
            notificationType: NotificationType.EMAIL_TEST,
            status: EmailAuditStatus.SENT,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        });

        const auditRecordId = auditRecords.length > 0 ? auditRecords[0].id : undefined;

        return {
          success: true,
          message: 'Test email sent successfully! Check the recipient\'s inbox.',
          auditRecordId,
          timestamp: timestamp.toISOString(),
          smtpConfiguration: {
            host: emailConfig.smtpHost,
            port: emailConfig.smtpPort || 587,
            secure: emailConfig.smtpUseSsl,
            senderEmail: emailConfig.senderEmail,
            senderName: emailConfig.senderName || 'PlayaPlan',
          },
        };
      } else {
        return {
          success: false,
          message: 'Failed to send test email. Please check your SMTP configuration and try again.',
          timestamp: timestamp.toISOString(),
          smtpConfiguration: {
            host: emailConfig.smtpHost,
            port: emailConfig.smtpPort || 587,
            secure: emailConfig.smtpUseSsl,
            senderEmail: emailConfig.senderEmail,
            senderName: emailConfig.senderName || 'PlayaPlan',
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
} 