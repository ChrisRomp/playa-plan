import { Injectable } from '@nestjs/common';
import { CoreConfigService } from '../../core-config/services/core-config.service';
import { ShiftsService } from '../../shifts/shifts.service';
import { GenerateWorkScheduleReportDto } from '../dto/generate-work-schedule-report.dto';
import { WorkScheduleReportData } from '../models/work-schedule-report-data';

/** Selects configuration and ordered shift assignments for work-schedule reports. */
@Injectable()
export class WorkScheduleDataService {
  constructor(
    private readonly shiftsService: ShiftsService,
    private readonly coreConfigService: CoreConfigService
  ) {}

  async getReportData(options: GenerateWorkScheduleReportDto): Promise<WorkScheduleReportData> {
    const configuration = await this.coreConfigService.findCurrent();
    const schedule = await this.shiftsService.getWorkSchedule(
      options.dayOfWeek,
      configuration.registrationYear,
      options.includeStaffOnly ?? true
    );

    return {
      campName: configuration.campName,
      year: configuration.registrationYear,
      shifts: schedule.shifts,
    };
  }
}
