import { RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { GenerateTicketReceiptReportDto } from '../dto/generate-ticket-receipt-report.dto';
import { TicketReceiptDataService } from './ticket-receipt-data.service';

describe('TicketReceiptDataService', () => {
  const mockFindMany = jest.fn();
  const mockFindCurrent = jest.fn();
  const mockPrisma = { registration: { findMany: mockFindMany } };
  const mockCoreConfig = { findCurrent: mockFindCurrent };
  let service: TicketReceiptDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketReceiptDataService(
      mockPrisma as unknown as PrismaService,
      mockCoreConfig as unknown as CoreConfigService
    );
  });

  it('shouldUseConfiguredYearAndFormatAssignments', async () => {
    mockFindCurrent.mockResolvedValue({ registrationYear: 2026 });
    mockFindMany.mockResolvedValue([
      {
        user: { firstName: 'Alex', lastName: 'Burner' },
        jobs: [
          { job: { name: 'Kitchen', shift: { name: 'Tuesday AM' } } },
          { job: { name: 'Gate', shift: { name: 'Monday PM' } } },
        ],
      },
    ]);
    const inputOptions = Object.assign(new GenerateTicketReceiptReportDto(), {
      title: 'Tickets',
      acknowledgementText: 'Received',
    });

    const actualData = await service.getReportData(inputOptions);

    expect(actualData).toEqual({
      year: 2026,
      attendees: [
        {
          name: 'Alex Burner',
          workShifts: 'Gate (Monday PM); Kitchen (Tuesday AM)',
        },
      ],
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: RegistrationStatus.CONFIRMED,
          year: 2026,
        },
      })
    );
  });

  it('shouldFilterByCampingOptionWhenSelected', async () => {
    mockFindMany.mockResolvedValue([]);
    const inputOptions = Object.assign(new GenerateTicketReceiptReportDto(), {
      title: 'Tickets',
      acknowledgementText: 'Received',
      year: 2025,
      campingOptionId: '89fb296e-201a-431d-a71c-9119871f41c2',
    });

    await service.getReportData(inputOptions);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: RegistrationStatus.CONFIRMED,
          year: 2025,
          campingOptionRegistrations: {
            some: {
              campingOptionId: '89fb296e-201a-431d-a71c-9119871f41c2',
            },
          },
        },
      })
    );
    expect(mockFindCurrent).not.toHaveBeenCalled();
  });
});
