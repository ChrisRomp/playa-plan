import { JobScheduleConflict } from '@playa-plan/types';

/** Result of applying work-shift requirement and schedule-conflict rules. */
export interface RegistrationJobSelectionAnalysis {
  readonly selectedCount: number;
  readonly requiredCount: number;
  readonly extraCount: number;
  readonly conflicts: readonly JobScheduleConflict[];
}
