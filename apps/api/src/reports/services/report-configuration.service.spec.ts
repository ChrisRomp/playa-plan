import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AdminAuditActionType, AdminAuditTargetType, Prisma, ReportType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TicketReceiptSettingsDto } from '../dto/ticket-receipt-settings.dto';
import { ReportConfigurationService } from './report-configuration.service';

describe('ReportConfigurationService', () => {
  const mockFindUnique = jest.fn();
  const mockTransactionFindUnique = jest.fn();
  const mockUpsert = jest.fn();
  const mockCreateAudit = jest.fn();
  const mockTransaction = jest.fn();
  const mockTransactionClient = {
    reportConfiguration: {
      findUnique: mockTransactionFindUnique,
      upsert: mockUpsert,
    },
    adminAudit: {
      create: mockCreateAudit,
    },
  };
  const mockPrisma = {
    reportConfiguration: {
      findUnique: mockFindUnique,
    },
    $transaction: mockTransaction,
  };
  let service: ReportConfigurationService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockTransaction.mockImplementation(
      async (operation: (transaction: typeof mockTransactionClient) => Promise<void>) =>
        operation(mockTransactionClient)
    );
    service = new ReportConfigurationService(mockPrisma as unknown as PrismaService);
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
    mockTransactionFindUnique.mockResolvedValue(null);
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
    expect(mockCreateAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: 'user-id',
        actionType: AdminAuditActionType.REPORT_CONFIGURATION_MODIFY,
        targetRecordType: AdminAuditTargetType.REPORT_CONFIGURATION,
      }),
    });
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('shouldSkipUnchangedSettings', async () => {
    mockTransactionFindUnique.mockResolvedValue({
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
    expect(mockCreateAudit).not.toHaveBeenCalled();
  });

  it('shouldAuditPreviousAndNextSettingsInSameTransaction', async () => {
    mockTransactionFindUnique.mockResolvedValue({
      id: 'configuration-id',
      reportType: ReportType.TICKET_RECEIPT_SIGNATURE,
      schemaVersion: 1,
      settings: {
        title: 'Previous title',
        acknowledgementText: 'Previous acknowledgement',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpsert.mockResolvedValue({
      id: 'configuration-id',
      reportType: ReportType.TICKET_RECEIPT_SIGNATURE,
      schemaVersion: 1,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const inputSettings = Object.assign(new TicketReceiptSettingsDto(), {
      title: 'Next title',
      acknowledgementText: 'Next acknowledgement',
    });

    await service.saveTicketReceiptSettings('user-id', inputSettings);

    expect(mockCreateAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        oldValues: {
          title: 'Previous title',
          acknowledgementText: 'Previous acknowledgement',
        },
        newValues: {
          title: 'Next title',
          acknowledgementText: 'Next acknowledgement',
        },
      }),
    });
  });

  it('shouldRejectWhenAuditCreationFails', async () => {
    mockTransactionFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({
      id: 'configuration-id',
      reportType: ReportType.TICKET_RECEIPT_SIGNATURE,
      schemaVersion: 1,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCreateAudit.mockRejectedValue(new Error('Audit unavailable'));
    const inputSettings = Object.assign(new TicketReceiptSettingsDto(), {
      title: 'Ticket Pickup',
      acknowledgementText: 'I received my ticket.',
    });

    await expect(service.saveTicketReceiptSettings('user-id', inputSettings)).rejects.toThrow(
      'Audit unavailable'
    );
  });

  it('shouldRetrySerializationConflicts', async () => {
    const serializationConflict = new Prisma.PrismaClientKnownRequestError(
      'Transaction write conflict',
      {
        code: 'P2034',
        clientVersion: 'test',
      }
    );
    mockTransaction
      .mockRejectedValueOnce(serializationConflict)
      .mockImplementationOnce(
        async (operation: (transaction: typeof mockTransactionClient) => Promise<void>) =>
          operation(mockTransactionClient)
      );
    mockTransactionFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({
      id: 'configuration-id',
      reportType: ReportType.TICKET_RECEIPT_SIGNATURE,
      schemaVersion: 1,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const inputSettings = Object.assign(new TicketReceiptSettingsDto(), {
      title: 'Ticket Pickup',
      acknowledgementText: 'I received my ticket.',
    });

    await service.saveTicketReceiptSettings('user-id', inputSettings);

    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(mockCreateAudit).toHaveBeenCalledTimes(1);
  });

  it('shouldRejectWhitespaceOnlyNormalizedSettings', async () => {
    const inputSettings = Object.assign(new TicketReceiptSettingsDto(), {
      title: '   ',
      acknowledgementText: 'I received my ticket.',
    });

    await expect(
      service.saveTicketReceiptSettings('user-id', inputSettings)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
