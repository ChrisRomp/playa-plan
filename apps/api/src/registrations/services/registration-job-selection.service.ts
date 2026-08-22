import { Injectable } from '@nestjs/common';
import { RegistrationJobSelectionAnalysis } from '../models/registration-job-selection-analysis';

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

interface ShiftInput {
  readonly id: string;
  readonly name: string;
  readonly dayOfWeek: string;
  readonly startTime: string;
  readonly endTime: string;
}

interface JobInput {
  readonly id: string;
  readonly name: string;
  readonly shift?: ShiftInput;
}

interface SelectionInput {
  readonly jobs: readonly JobInput[];
  readonly allowNoJob: boolean;
  readonly campingOptions: ReadonlyArray<{ readonly workShiftsRequired: number }>;
  readonly alwaysRequiredCategories: ReadonlyArray<{ readonly id: string }>;
}

interface ShiftInterval {
  readonly start: number;
  readonly end: number;
}

/** Applies participant work-shift requirements and conflict rules. */
@Injectable()
export class RegistrationJobSelectionService {
  /**
   * Analyze selected jobs against the current registration requirements.
   */
  analyze(input: SelectionInput): RegistrationJobSelectionAnalysis {
    const requiredCount = this.calculateRequiredCount(input);
    const selectedCount = input.jobs.length;

    return {
      selectedCount,
      requiredCount,
      extraCount: Math.max(0, selectedCount - requiredCount),
      conflicts: this.findConflicts(input.jobs),
    };
  }

  private calculateRequiredCount(input: SelectionInput): number {
    if (input.allowNoJob) {
      return 0;
    }

    const campingRequirement = input.campingOptions.reduce(
      (total, option) => total + option.workShiftsRequired,
      0,
    );

    return campingRequirement + input.alwaysRequiredCategories.length;
  }

  private findConflicts(
    jobs: readonly JobInput[],
  ): RegistrationJobSelectionAnalysis['conflicts'] {
    const conflicts: Array<
      RegistrationJobSelectionAnalysis['conflicts'][number]
    > = [];

    for (let firstIndex = 0; firstIndex < jobs.length; firstIndex += 1) {
      const firstJob = jobs[firstIndex];
      if (
        !firstJob?.shift ||
        this.isIgnoredConflictDay(firstJob.shift.dayOfWeek)
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
          this.isIgnoredConflictDay(secondJob.shift.dayOfWeek)
        ) {
          continue;
        }

        if (
          firstJob.shift.id === secondJob.shift.id ||
          this.intervalsOverlap(firstJob.shift, secondJob.shift)
        ) {
          conflicts.push({
            firstJob: {
              id: firstJob.id,
              name: firstJob.name,
              shift: firstJob.shift,
            },
            secondJob: {
              id: secondJob.id,
              name: secondJob.name,
              shift: secondJob.shift,
            },
          });
        }
      }
    }

    return conflicts;
  }

  private intervalsOverlap(firstShift: ShiftInput, secondShift: ShiftInput): boolean {
    const firstInterval = this.createInterval(firstShift);
    const secondInterval = this.createInterval(secondShift);
    if (!firstInterval || !secondInterval) {
      return false;
    }

    return (
      firstInterval.start < secondInterval.end &&
      secondInterval.start < firstInterval.end
    );
  }

  private createInterval(shift: ShiftInput): ShiftInterval | null {
    const dayOffset = EVENT_DAY_OFFSETS[shift.dayOfWeek];
    if (dayOffset === undefined) {
      return null;
    }

    const start = dayOffset * MINUTES_PER_DAY + this.parseTime(shift.startTime);
    let end = dayOffset * MINUTES_PER_DAY + this.parseTime(shift.endTime);
    if (end <= start) {
      end += MINUTES_PER_DAY;
    }

    return { start, end };
  }

  private parseTime(time: string): number {
    const [hours = 0, minutes = 0] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private isIgnoredConflictDay(dayOfWeek: string): boolean {
    return IGNORED_CONFLICT_DAYS.has(dayOfWeek);
  }
}
