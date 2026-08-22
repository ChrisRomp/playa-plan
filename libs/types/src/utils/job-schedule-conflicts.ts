const MINUTES_PER_DAY = 24 * 60;
const IGNORED_CONFLICT_DAYS = new Set(['PRE_OPENING', 'POST_EVENT']);
const EVENT_DAY_OFFSETS: Readonly<Record<string, number>> = {
  OPENING_SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  CLOSING_SUNDAY: 7,
};

export interface ScheduleShift {
  readonly id: string;
  readonly name: string;
  readonly dayOfWeek: string;
  readonly startTime: string;
  readonly endTime: string;
}

export interface ScheduleJob {
  readonly id: string;
  readonly name: string;
  readonly shift?: ScheduleShift;
}

interface ScheduledJob extends ScheduleJob {
  readonly shift: ScheduleShift;
}

export interface JobScheduleConflict {
  readonly firstJob: ScheduledJob;
  readonly secondJob: ScheduledJob;
}

interface ShiftInterval {
  readonly start: number;
  readonly end: number;
}

/**
 * Finds schedule conflicts using half-open intervals, including overnight shifts.
 */
export function findJobScheduleConflicts(
  jobs: readonly ScheduleJob[],
): JobScheduleConflict[] {
  const conflicts: JobScheduleConflict[] = [];

  for (let firstIndex = 0; firstIndex < jobs.length; firstIndex += 1) {
    const firstJob = jobs[firstIndex];
    if (!firstJob?.shift || isIgnoredConflictDay(firstJob.shift.dayOfWeek)) {
      continue;
    }

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < jobs.length;
      secondIndex += 1
    ) {
      const secondJob = jobs[secondIndex];
      if (!secondJob?.shift || isIgnoredConflictDay(secondJob.shift.dayOfWeek)) {
        continue;
      }

      if (
        firstJob.shift.id === secondJob.shift.id ||
        intervalsOverlap(firstJob.shift, secondJob.shift)
      ) {
        conflicts.push({
          firstJob: { ...firstJob, shift: firstJob.shift },
          secondJob: { ...secondJob, shift: secondJob.shift },
        });
      }
    }
  }

  return conflicts;
}

function intervalsOverlap(
  firstShift: ScheduleShift,
  secondShift: ScheduleShift,
): boolean {
  const firstInterval = createInterval(firstShift);
  const secondInterval = createInterval(secondShift);
  if (!firstInterval || !secondInterval) {
    return false;
  }

  return (
    firstInterval.start < secondInterval.end &&
    secondInterval.start < firstInterval.end
  );
}

function createInterval(shift: ScheduleShift): ShiftInterval | null {
  const dayOffset = EVENT_DAY_OFFSETS[shift.dayOfWeek];
  if (dayOffset === undefined) {
    return null;
  }

  const start = dayOffset * MINUTES_PER_DAY + parseTime(shift.startTime);
  let end = dayOffset * MINUTES_PER_DAY + parseTime(shift.endTime);
  if (end <= start) {
    end += MINUTES_PER_DAY;
  }

  return { start, end };
}

function parseTime(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function isIgnoredConflictDay(dayOfWeek: string): boolean {
  return IGNORED_CONFLICT_DAYS.has(dayOfWeek);
}
