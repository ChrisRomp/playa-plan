interface AnalyzedShift {
  readonly id: string;
  readonly name: string;
  readonly dayOfWeek: string;
  readonly startTime: string;
  readonly endTime: string;
}

interface AnalyzedJob {
  readonly id: string;
  readonly name: string;
  readonly shift: AnalyzedShift;
}

interface JobScheduleConflict {
  readonly firstJob: AnalyzedJob;
  readonly secondJob: AnalyzedJob;
}

/** Result of applying work-shift requirement and schedule-conflict rules. */
export interface RegistrationJobSelectionAnalysis {
  readonly selectedCount: number;
  readonly requiredCount: number;
  readonly extraCount: number;
  readonly conflicts: readonly JobScheduleConflict[];
}
