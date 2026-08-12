import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../../auth/types/safe-user';
import { GenerateTicketReceiptReportDto } from '../dto/generate-ticket-receipt-report.dto';
import { TicketReceiptSettingsDto } from '../dto/ticket-receipt-settings.dto';
import { ReportConfigurationService } from '../services/report-configuration.service';
import { TicketReceiptReportService } from '../services/ticket-receipt-report.service';

/** Staff/admin endpoints for report configuration and generation. */
@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class ReportsController {
  constructor(
    private readonly configurationService: ReportConfigurationService,
    private readonly ticketReceiptReportService: TicketReceiptReportService
  ) {}

  @Get('ticket-receipt/configuration')
  @ApiOperation({ summary: 'Get shared ticket-receipt report defaults' })
  @ApiResponse({ status: 200, type: TicketReceiptSettingsDto })
  getTicketReceiptConfiguration(): Promise<TicketReceiptSettingsDto> {
    return this.configurationService.getTicketReceiptSettings();
  }

  @Post('ticket-receipt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a ticket-receipt signature form' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'Generated PDF report' })
  @ApiResponse({ status: 404, description: 'No matching attendees or blank rows' })
  async generateTicketReceiptReport(
    @Body() options: GenerateTicketReceiptReportDto,
    @Request() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    const download = await this.ticketReceiptReportService.generate(request.user.id, options);
    response.setHeader('Content-Type', download.contentType);
    response.setHeader('Content-Disposition', download.contentDisposition);

    return new StreamableFile(download.buffer);
  }
}
