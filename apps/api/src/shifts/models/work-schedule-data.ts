import { DayOfWeek } from '@prisma/client';

interface WorkScheduleUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly playaName: string | null;
}

interface WorkScheduleRegistration {
  readonly id: string;
  readonly user: WorkScheduleUser;
}

interface WorkScheduleJob {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly maxRegistrations: number;
  readonly categoryId: string;
  readonly category: {
    readonly id: string;
    readonly name: string;
  };
  readonly registrations: ReadonlyArray<WorkScheduleRegistration>;
}

interface WorkScheduleShift {
  readonly id: string;
  readonly name: string;
  readonly dayOfWeek: DayOfWeek;
  readonly startTime: string;
  readonly endTime: string;
  readonly jobs: ReadonlyArray<WorkScheduleJob>;
}

/** Ordered shifts, jobs, and worker assignments for the configured registration year. */
export interface WorkScheduleData {
  readonly shifts: ReadonlyArray<WorkScheduleShift>;
}
