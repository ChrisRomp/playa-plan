/**
 * Shared utility functions for shift-related formatting
 */

/**
 * Convert a day enum value to a friendly display name
 */
export const getFriendlyDayName = (day: string): string => {
  if (!day) return '';
  
  const dayMap: Record<string, string> = {
    // Standard days
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday',
    // Special event days from schema
    PRE_OPENING: 'Pre-Opening',
    OPENING_SUNDAY: 'Opening Sunday',
    CLOSING_SUNDAY: 'Closing Sunday',
    POST_EVENT: 'Post-Event',
    // Handle lowercase versions too
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    pre_opening: 'Pre-Opening',
    opening_sunday: 'Opening Sunday',
    closing_sunday: 'Closing Sunday',
    post_event: 'Post-Event'
  };
  return dayMap[day] || day; // Return mapped value or original if not found
};

/**
 * Format a time string for display
 */
export const formatTime = (timeString: string): string => {
  try {
    // Check if timeString is already a time string in HH:MM format
    if (/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }
    
    const date = new Date(timeString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return timeString;
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    // Return the original string if parsing fails
    return timeString;
  }
};

/**
 * Convert a 24-hour time string to minutes after midnight for chronological sorting.
 */
export const getTimeInMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

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

interface ScheduleShift {
  id: string;
  name: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

interface ScheduleJob {
  id: string;
  name: string;
  shift?: ScheduleShift;
}

export interface JobScheduleConflict {
  firstJob: ScheduleJob;
  secondJob: ScheduleJob;
}

const createShiftInterval = (
  shift: ScheduleShift,
): { start: number; end: number } | null => {
  const dayOffset = EVENT_DAY_OFFSETS[shift.dayOfWeek];
  if (dayOffset === undefined) {
    return null;
  }

  const start = dayOffset * MINUTES_PER_DAY + getTimeInMinutes(shift.startTime);
  let end = dayOffset * MINUTES_PER_DAY + getTimeInMinutes(shift.endTime);
  if (end <= start) {
    end += MINUTES_PER_DAY;
  }

  return { start, end };
};

/**
 * Find conflicts among jobs with known schedules.
 */
export const findJobScheduleConflicts = (
  jobs: readonly ScheduleJob[],
): JobScheduleConflict[] => {
  const conflicts: JobScheduleConflict[] = [];

  for (let firstIndex = 0; firstIndex < jobs.length; firstIndex += 1) {
    const firstJob = jobs[firstIndex];
    if (
      !firstJob?.shift ||
      IGNORED_CONFLICT_DAYS.has(firstJob.shift.dayOfWeek)
    ) {
      continue;
    }

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < jobs.length;
      secondIndex += 1
    ) {
      const secondJob = jobs[secondIndex];
      if (
        !secondJob?.shift ||
        IGNORED_CONFLICT_DAYS.has(secondJob.shift.dayOfWeek)
      ) {
        continue;
      }

      const firstInterval = createShiftInterval(firstJob.shift);
      const secondInterval = createShiftInterval(secondJob.shift);
      const intervalsOverlap =
        firstInterval !== null &&
        secondInterval !== null &&
        firstInterval.start < secondInterval.end &&
        secondInterval.start < firstInterval.end;

      if (firstJob.shift.id === secondJob.shift.id || intervalsOverlap) {
        conflicts.push({ firstJob, secondJob });
      }
    }
  }

  return conflicts;
};