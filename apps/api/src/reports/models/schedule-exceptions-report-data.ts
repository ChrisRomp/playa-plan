interface ScheduleExceptionUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly playaName: string | null;
  readonly email: string;
  readonly role: string;
  readonly allowNoJob: boolean;
}

interface ScheduleExceptionShift {
  readonly id: string;
  readonly name: string;
  readonly dayOfWeek: string;
  readonly startTime: string;
  readonly endTime: string;
}

interface ScheduleExceptionJob {
  readonly id: string;
  readonly name: string;
  readonly categoryName: string;
  readonly shift: ScheduleExceptionShift;
}

interface ScheduleConflictJob {
  readonly id: string;
  readonly name: string;
  readonly shift: ScheduleExceptionShift;
}

interface ScheduleExceptionConflict {
  readonly firstJob: ScheduleConflictJob;
  readonly secondJob: ScheduleConflictJob;
}

interface ScheduleExceptionRegistration {
  readonly registrationId: string;
  readonly user: ScheduleExceptionUser;
  readonly requiredCount: number;
  readonly selectedCount: number;
  readonly extraCount: number;
  readonly jobs: readonly ScheduleExceptionJob[];
  readonly conflicts: readonly ScheduleExceptionConflict[];
}

/** Current-year confirmed registrations with work-schedule exceptions. */
export interface ScheduleExceptionsReportData {
  readonly year: number;
  readonly exceptions: readonly ScheduleExceptionRegistration[];
}
