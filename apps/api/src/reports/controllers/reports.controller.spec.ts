import { StreamableFile } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../auth/types/safe-user';
import { GenerateTicketReceiptReportDto } from '../dto/generate-ticket-receipt-report.dto';
import { GenerateWorkScheduleReportDto } from '../dto/generate-work-schedule-report.dto';
import { ReportConfigurationService } from '../services/report-configuration.service';
import { ScheduleExceptionsReportService } from '../services/schedule-exceptions-report.service';
import { TicketReceiptReportService } from '../services/ticket-receipt-report.service';
import { WorkScheduleReportService } from '../services/work-schedule-report.service';
import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  const mockGetSettings = jest.fn();
  const mockGenerateTicketReceipt = jest.fn();
  const mockGenerateWorkSchedule = jest.fn();
  const mockGetScheduleExceptions = jest.fn();
  const mockSetHeader = jest.fn();
  let controller: ReportsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReportsController(
      {
        getTicketReceiptSettings: mockGetSettings,
      } as unknown as ReportConfigurationService,
      {
        generate: mockGenerateTicketReceipt,
      } as unknown as TicketReceiptReportService,
      {
        generate: mockGenerateWorkSchedule,
      } as unknown as WorkScheduleReportService,
      {
        getReportData: mockGetScheduleExceptions,
      } as unknown as ScheduleExceptionsReportService,
    );
  });

  it('shouldRequireStaffOrAdminRoleForAllReportEndpoints', () => {
    const actualRoles = Reflect.getMetadata('roles', ReportsController);

    expect(actualRoles).toEqual([UserRole.ADMIN, UserRole.STAFF]);
    expect(actualRoles).not.toContain(UserRole.PARTICIPANT);
  });

  it('shouldReturnSharedTicketReceiptSettings', async () => {
    const expectedSettings = {
      title: 'Ticket Receipt Report',
      acknowledgementText: 'I received my ticket.',
    };
    mockGetSettings.mockResolvedValue(expectedSettings);

    const actualSettings = await controller.getTicketReceiptConfiguration();

    expect(actualSettings).toBe(expectedSettings);
  });

  it('shouldReturnScheduleExceptions', async () => {
    const expectedReport = { year: 2026, exceptions: [] };
    mockGetScheduleExceptions.mockResolvedValue(expectedReport);

    await expect(controller.getScheduleExceptions()).resolves.toBe(
      expectedReport,
    );
  });

  it('shouldReturnPdfWithSafeDownloadHeaders', async () => {
    const inputOptions = Object.assign(new GenerateTicketReceiptReportDto(), {
      title: 'Ticket Receipt Report',
      acknowledgementText: 'I received my ticket.',
    });
    const inputRequest = {
      user: { id: 'user-id' },
    } as unknown as AuthenticatedRequest;
    const inputResponse = {
      setHeader: mockSetHeader,
    } as unknown as Response;
    mockGenerateTicketReceipt.mockResolvedValue({
      buffer: Buffer.from('%PDF'),
      contentType: 'application/pdf',
      contentDisposition: 'attachment; filename="tickets.pdf"',
      filename: 'tickets.pdf',
    });

    const actualFile = await controller.generateTicketReceiptReport(
      inputOptions,
      inputRequest,
      inputResponse
    );

    expect(actualFile).toBeInstanceOf(StreamableFile);
    expect(mockGenerateTicketReceipt).toHaveBeenCalledWith('user-id', inputOptions);
    expect(mockSetHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(mockSetHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="tickets.pdf"'
    );
  });

  it('shouldReturnAWorkSchedulePdfWithSafeDownloadHeaders', async () => {
    const inputOptions = new GenerateWorkScheduleReportDto();
    const inputResponse = {
      setHeader: mockSetHeader,
    } as unknown as Response;
    mockGenerateWorkSchedule.mockResolvedValue({
      buffer: Buffer.from('%PDF'),
      contentType: 'application/pdf',
      contentDisposition: 'attachment; filename="work-schedule.pdf"',
      filename: 'work-schedule.pdf',
    });

    const actualFile = await controller.generateWorkScheduleReport(
      inputOptions,
      inputResponse
    );

    expect(actualFile).toBeInstanceOf(StreamableFile);
    expect(mockGenerateWorkSchedule).toHaveBeenCalledWith(inputOptions);
    expect(mockSetHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(mockSetHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="work-schedule.pdf"'
    );
  });
});
