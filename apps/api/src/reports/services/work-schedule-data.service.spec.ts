import { DayOfWeek } from '@prisma/client';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { ShiftsService } from '../../shifts/shifts.service';
import { GenerateWorkScheduleReportDto } from '../dto/generate-work-schedule-report.dto';
import { WorkScheduleDataService } from './work-schedule-data.service';

describe('WorkScheduleDataService', () => {
  it('shouldUseConfiguredCampYearAndSelectedFilters', async () => {
    const mockGetWorkSchedule = jest.fn().mockResolvedValue({ shifts: [] });
    const service = new WorkScheduleDataService(
      { getWorkSchedule: mockGetWorkSchedule } as unknown as ShiftsService,
      {
        findCurrent: jest.fn().mockResolvedValue({
          campName: 'Burning Sky',
          registrationYear: 2026,
        }),
      } as unknown as CoreConfigService
    );
    const inputOptions = Object.assign(new GenerateWorkScheduleReportDto(), {
      dayOfWeek: DayOfWeek.CLOSING_SUNDAY,
      includeStaffOnly: false,
    });

    const actualData = await service.getReportData(inputOptions);

    expect(mockGetWorkSchedule).toHaveBeenCalledWith(
      DayOfWeek.CLOSING_SUNDAY,
      2026,
      false
    );
    expect(actualData).toEqual({
      campName: 'Burning Sky',
      year: 2026,
      shifts: [],
    });
  });
});
