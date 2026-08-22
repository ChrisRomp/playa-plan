import { RegistrationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { RegistrationJobSelectionService } from '../../registrations/services/registration-job-selection.service';
import { ScheduleExceptionsReportService } from './schedule-exceptions-report.service';

describe('ScheduleExceptionsReportService', () => {
  const mockFindCurrent = jest.fn();
  const mockFindCategories = jest.fn();
  const mockFindRegistrations = jest.fn();
  const mockPrisma = {
    jobCategory: { findMany: mockFindCategories },
    registration: { findMany: mockFindRegistrations },
  };
  let service: ScheduleExceptionsReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScheduleExceptionsReportService(
      mockPrisma as unknown as PrismaService,
      { findCurrent: mockFindCurrent } as unknown as CoreConfigService,
      new RegistrationJobSelectionService(),
    );
    mockFindCurrent.mockResolvedValue({ registrationYear: 2026 });
    mockFindCategories.mockResolvedValue([
      { id: 'general-required', staffOnly: false },
      { id: 'staff-required', staffOnly: true },
    ]);
  });

  it('shouldReportCurrentYearConfirmedOveragesAndConflicts', async () => {
    mockFindRegistrations.mockResolvedValue([
      {
        id: 'registration-overage',
        user: {
          id: 'user-overage',
          firstName: 'Alex',
          lastName: 'Burner',
          playaName: null,
          email: 'alex@example.com',
          role: UserRole.PARTICIPANT,
          allowNoJob: true,
        },
        campingOptionRegistrations: [],
        jobs: [
          {
            job: {
              id: 'job-overage',
              name: 'Kitchen',
              category: { name: 'Kitchen' },
              shift: {
                id: 'shift-overage',
                name: 'Monday AM',
                dayOfWeek: 'MONDAY',
                startTime: '09:00',
                endTime: '11:00',
              },
            },
          },
        ],
      },
      {
        id: 'registration-conflict',
        user: {
          id: 'user-conflict',
          firstName: 'Bailey',
          lastName: 'Camper',
          playaName: 'Bails',
          email: 'bailey@example.com',
          role: UserRole.PARTICIPANT,
          allowNoJob: false,
        },
        campingOptionRegistrations: [
          { campingOption: { workShiftsRequired: 1 } },
        ],
        jobs: [
          {
            job: {
              id: 'job-first',
              name: 'First Job',
              category: { name: 'General' },
              shift: {
                id: 'shift-first',
                name: 'Monday AM',
                dayOfWeek: 'MONDAY',
                startTime: '09:00',
                endTime: '12:00',
              },
            },
          },
          {
            job: {
              id: 'job-second',
              name: 'Second Job',
              category: { name: 'General' },
              shift: {
                id: 'shift-second',
                name: 'Monday Midday',
                dayOfWeek: 'MONDAY',
                startTime: '11:00',
                endTime: '13:00',
              },
            },
          },
        ],
      },
      {
        id: 'registration-staff-valid',
        user: {
          id: 'user-staff',
          firstName: 'Casey',
          lastName: 'Staffer',
          playaName: null,
          email: 'casey@example.com',
          role: UserRole.STAFF,
          allowNoJob: false,
        },
        campingOptionRegistrations: [],
        jobs: [
          {
            job: {
              id: 'job-staff-first',
              name: 'Staff First',
              category: { name: 'Staff' },
              shift: {
                id: 'shift-staff-first',
                name: 'Tuesday AM',
                dayOfWeek: 'TUESDAY',
                startTime: '09:00',
                endTime: '10:00',
              },
            },
          },
          {
            job: {
              id: 'job-staff-second',
              name: 'Staff Second',
              category: { name: 'Staff' },
              shift: {
                id: 'shift-staff-second',
                name: 'Tuesday PM',
                dayOfWeek: 'TUESDAY',
                startTime: '13:00',
                endTime: '14:00',
              },
            },
          },
        ],
      },
    ]);

    const actualReport = await service.getReportData();

    expect(actualReport.year).toBe(2026);
    expect(actualReport.exceptions).toHaveLength(2);
    expect(actualReport.exceptions[0]).toEqual(
      expect.objectContaining({
        registrationId: 'registration-overage',
        requiredCount: 0,
        selectedCount: 1,
        extraCount: 1,
        conflicts: [],
      }),
    );
    expect(actualReport.exceptions[1]).toEqual(
      expect.objectContaining({
        registrationId: 'registration-conflict',
        requiredCount: 2,
        selectedCount: 2,
        extraCount: 0,
        conflicts: [
          expect.objectContaining({
            firstJob: expect.objectContaining({ id: 'job-first' }),
            secondJob: expect.objectContaining({ id: 'job-second' }),
          }),
        ],
      }),
    );
    expect(actualReport.exceptions[1].conflicts[0].firstJob).not.toHaveProperty(
      'category',
    );
    expect(mockFindRegistrations).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: RegistrationStatus.CONFIRMED,
          year: 2026,
        },
      }),
    );
  });

  it('shouldReturnAnEmptyReportWhenNoRegistrationHasExceptions', async () => {
    mockFindRegistrations.mockResolvedValue([]);

    await expect(service.getReportData()).resolves.toEqual({
      year: 2026,
      exceptions: [],
    });
  });
});
