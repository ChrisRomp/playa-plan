import { WorkScheduleData } from '../../shifts/models/work-schedule-data';

/** Configuration and schedule rows required by the work-schedule PDF builder. */
export interface WorkScheduleReportData extends WorkScheduleData {
  readonly campName: string;
  readonly year: number;
}
