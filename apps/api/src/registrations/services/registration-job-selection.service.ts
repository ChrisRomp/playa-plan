import { Injectable } from '@nestjs/common';
import { findJobScheduleConflicts, ScheduleJob } from '@playa-plan/types';
import { RegistrationJobSelectionAnalysis } from '../models/registration-job-selection-analysis';

interface SelectionInput {
  readonly jobs: readonly ScheduleJob[];
  readonly allowNoJob: boolean;
  readonly campingOptions: ReadonlyArray<{ readonly workShiftsRequired: number }>;
  readonly alwaysRequiredCategories: ReadonlyArray<{ readonly id: string }>;
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
      conflicts: findJobScheduleConflicts(input.jobs),
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

}
