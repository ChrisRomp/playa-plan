import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminAuditActionType,
  AdminAuditTargetType,
  Prisma,
  ReportConfiguration,
  ReportType,
} from '@prisma/client';
import { AdminAuditService } from '../../admin-audit/services/admin-audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TicketReceiptSettingsDto } from '../dto/ticket-receipt-settings.dto';

const TICKET_RECEIPT_SCHEMA_VERSION = 1;
const DEFAULT_TICKET_RECEIPT_TITLE = 'Ticket Receipt Report';

/** Persists and validates shared defaults for supported report types. */
@Injectable()
export class ReportConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAuditService: AdminAuditService
  ) {}

  async getTicketReceiptSettings(): Promise<TicketReceiptSettingsDto> {
    const configuration = await this.prisma.reportConfiguration.findUnique({
      where: { reportType: ReportType.TICKET_RECEIPT_SIGNATURE },
    });

    if (!configuration) {
      return this.createDefaultTicketReceiptSettings();
    }

    return this.parseTicketReceiptSettings(configuration);
  }

  async saveTicketReceiptSettings(
    userId: string,
    settings: TicketReceiptSettingsDto
  ): Promise<void> {
    const normalized = this.normalizeSettings(settings);
    await this.validateNormalizedSettings(normalized);
    const existing = await this.prisma.reportConfiguration.findUnique({
      where: { reportType: ReportType.TICKET_RECEIPT_SIGNATURE },
    });
    const previous = existing ? await this.parseTicketReceiptSettings(existing) : null;

    if (previous && this.settingsEqual(previous, normalized)) {
      return;
    }

    const saved = await this.persistSettings(normalized);
    await this.auditSettingsChange(userId, saved.id, previous, normalized);
  }

  private createDefaultTicketReceiptSettings(): TicketReceiptSettingsDto {
    return plainToInstance(TicketReceiptSettingsDto, {
      title: DEFAULT_TICKET_RECEIPT_TITLE,
      acknowledgementText: '',
    });
  }

  private async parseTicketReceiptSettings(
    configuration: ReportConfiguration
  ): Promise<TicketReceiptSettingsDto> {
    if (
      configuration.schemaVersion !== TICKET_RECEIPT_SCHEMA_VERSION ||
      !this.isJsonObject(configuration.settings)
    ) {
      throw new InternalServerErrorException(
        'Stored ticket receipt report configuration is invalid'
      );
    }

    const settings = plainToInstance(TicketReceiptSettingsDto, configuration.settings);
    const errors = await validate(settings);
    if (errors.length > 0) {
      throw new InternalServerErrorException(
        'Stored ticket receipt report configuration is invalid'
      );
    }

    return settings;
  }

  private normalizeSettings(settings: TicketReceiptSettingsDto): TicketReceiptSettingsDto {
    return plainToInstance(TicketReceiptSettingsDto, {
      title: settings.title.trim(),
      acknowledgementText: settings.acknowledgementText.trim(),
    });
  }

  private settingsEqual(
    current: TicketReceiptSettingsDto,
    next: TicketReceiptSettingsDto
  ): boolean {
    return current.title === next.title && current.acknowledgementText === next.acknowledgementText;
  }

  private persistSettings(settings: TicketReceiptSettingsDto): Promise<ReportConfiguration> {
    const jsonSettings = {
      title: settings.title,
      acknowledgementText: settings.acknowledgementText,
    } satisfies Prisma.InputJsonObject;

    return this.prisma.reportConfiguration.upsert({
      where: { reportType: ReportType.TICKET_RECEIPT_SIGNATURE },
      create: {
        reportType: ReportType.TICKET_RECEIPT_SIGNATURE,
        schemaVersion: TICKET_RECEIPT_SCHEMA_VERSION,
        settings: jsonSettings,
      },
      update: {
        schemaVersion: TICKET_RECEIPT_SCHEMA_VERSION,
        settings: jsonSettings,
      },
    });
  }

  private async validateNormalizedSettings(settings: TicketReceiptSettingsDto): Promise<void> {
    const errors = await validate(settings);
    if (errors.length > 0) {
      throw new BadRequestException('Ticket receipt report settings are invalid');
    }
  }

  private async auditSettingsChange(
    userId: string,
    configurationId: string,
    previous: TicketReceiptSettingsDto | null,
    next: TicketReceiptSettingsDto
  ): Promise<void> {
    await this.adminAuditService.createAuditRecord({
      adminUserId: userId,
      actionType: AdminAuditActionType.REPORT_CONFIGURATION_MODIFY,
      targetRecordType: AdminAuditTargetType.REPORT_CONFIGURATION,
      targetRecordId: configurationId,
      oldValues: previous
        ? {
            title: previous.title,
            acknowledgementText: previous.acknowledgementText,
          }
        : undefined,
      newValues: {
        title: next.title,
        acknowledgementText: next.acknowledgementText,
      },
      throwOnError: false,
    });
  }

  private isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
