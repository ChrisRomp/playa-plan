import { Body, Controller, Post, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from '../services/notifications.service';
import { EmailService } from '../services/email.service';
import { EmailAuditService } from '../services/email-audit.service';
import { SendEmailDto, SendEmailToMultipleRecipientsDto } from '../dto/send-email.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, NotificationType } from '@prisma/client';

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
  async sendTestEmail(@Body('email') email: string): Promise<{ success: boolean }> {
    const result = await this.notificationsService.sendEmailVerificationEmail(email, 'test-token');
    return { success: result };
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