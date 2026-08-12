import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AdminAuditActionType, AdminAuditTargetType, ReportType } from '@prisma/client';
import { AdminAuditService } from '../../admin-audit/services/admin-audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TicketReceiptSettingsDto } from '../dto/ticket-receipt-settings.dto';
import { ReportConfigurationService } from './report-configuration.service';

describe('ReportConfigurationService', () => {
  const mockFindUnique = jest.fn();
  const mockUpsert = jest.fn();
  const mockCreateAuditRecord = jest.fn();
  const mockPrisma = {
    reportConfiguration: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  };
  const mockAuditService = {
    createAuditRecord: mockCreateAuditRecord,
  };
  let service: ReportConfigurationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportConfigurationService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AdminAuditService
    );
  });

  it('shouldReturnInitialDefaultsWhenNoConfigurationExists', async () => {
    mockFindUnique.mockResolvedValue(null);

    const actualSettings = await service.getTicketReceiptSettings();

    expect(actualSettings).toEqual({
      title: 'Ticket Receipt Report',
      acknowledgementText: '',
    });
  });

  it('shouldRejectInvalidStoredSettings', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'configuration-id',
      reportType: ReportType.TICKET_RECEIPT_SIGNATURE,
      schemaVersion: 1,
      settings: { title: '', acknowledgementText: '' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.getTicketReceiptSettings()).rejects.toBeInstanceOf(
      InternalServerErrorException
    );
  });

  it('shouldCreateAndAuditChangedSettings', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({
      id: '3da2b54a-86ae-4e7e-b01c-8808e11fe48c',
      reportType: ReportType.TICKET_RECEIPT_SIGNATURE,
      schemaVersion: 1,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const inputSettings = Object.assign(new TicketReceiptSettingsDto(), {
      title: ' Ticket Pickup ',
      acknowledgementText: ' I received my ticket. ',
    });

    await service.saveTicketReceiptSettings('user-id', inputSettings);

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { reportType: ReportType.TICKET_RECEIPT_SIGNATURE },
      create: {
        reportType: ReportType.TICKET_RECEIPT_SIGNATURE,
        schemaVersion: 1,
        settings: {
          title: 'Ticket Pickup',
          acknowledgementText: 'I received my ticket.',
        },
      },
      update: {
        schemaVersion: 1,
        settings: {
          title: 'Ticket Pickup',
          acknowledgementText: 'I received my ticket.',
        },
      },
    });
    expect(mockCreateAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: 'user-id',
        actionType: AdminAuditActionType.REPORT_CONFIGURATION_MODIFY,
        targetRecordType: AdminAuditTargetType.REPORT_CONFIGURATION,
      })
    );
  });

  it('shouldSkipUnchangedSettings', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'configuration-id',
      reportType: ReportType.TICKET_RECEIPT_SIGNATURE,
      schemaVersion: 1,
      settings: {
        title: 'Ticket Pickup',
        acknowledgementText: 'I received my ticket.',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const inputSettings = Object.assign(new TicketReceiptSettingsDto(), {
      title: 'Ticket Pickup',
      acknowledgementText: 'I received my ticket.',
    });

    await service.saveTicketReceiptSettings('user-id', inputSettings);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('shouldRejectWhitespaceOnlyNormalizedSettings', async () => {
    const inputSettings = Object.assign(new TicketReceiptSettingsDto(), {
      title: '   ',
      acknowledgementText: 'I received my ticket.',
    });

    await expect(
      service.saveTicketReceiptSettings('user-id', inputSettings)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
