import { Injectable } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { Content, ContentColumns, ContentStack, TDocumentDefinitions } from 'pdfmake/interfaces';
import { WorkScheduleReportData } from '../models/work-schedule-report-data';

const MAX_BULLETED_SHIFT_CAPACITY = 10;
const MAX_ROSTER_ITEMS_PER_COLUMN = 42;
const MAX_ESTIMATED_LINES_PER_SHIFT_COLUMN = 46;
const ESTIMATED_CHARACTERS_PER_COLUMN_LINE = 38;
const SHIFT_INDENT = 18;
const JOB_INDENT = 30;
const ROSTER_INDENT = 44;
const DAY_NAMES: Readonly<Record<DayOfWeek, string>> = {
  [DayOfWeek.PRE_OPENING]: 'Pre-Opening',
  [DayOfWeek.OPENING_SUNDAY]: 'Opening Sunday',
  [DayOfWeek.MONDAY]: 'Monday',
  [DayOfWeek.TUESDAY]: 'Tuesday',
  [DayOfWeek.WEDNESDAY]: 'Wednesday',
  [DayOfWeek.THURSDAY]: 'Thursday',
  [DayOfWeek.FRIDAY]: 'Friday',
  [DayOfWeek.SATURDAY]: 'Saturday',
  [DayOfWeek.CLOSING_SUNDAY]: 'Closing Sunday',
  [DayOfWeek.POST_EVENT]: 'Post-Event',
};

type ScheduleShift = WorkScheduleReportData['shifts'][number];
type ScheduleJob = ScheduleShift['jobs'][number];

/** Builds the work-schedule-specific pdfmake document definition. */
@Injectable()
export class WorkScheduleDocumentService {
  build(data: WorkScheduleReportData): TDocumentDefinitions {
    const title = `${data.campName} Work Schedule ${data.year}`;
    const days = this.groupShiftsByDay(data.shifts);

    return {
      pageSize: 'LETTER',
      pageOrientation: 'portrait',
      pageMargins: [36, 62, 36, 36],
      info: {
        title,
        author: 'PlayaPlan',
        subject: `Work schedule for ${data.year}`,
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
      },
      header: {
        text: title,
        alignment: 'center',
        bold: true,
        fontSize: 16,
        margin: [36, 24, 36, 0],
      },
      footer: (currentPage: number, pageCount: number) => ({
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'center',
        fontSize: 8,
        margin: [0, 12, 0, 0],
      }),
      content: days.map(([day, shifts], index) => ({
        stack: [
          {
            text: DAY_NAMES[day],
            style: 'dayHeading',
          },
          ...this.buildDayContent(shifts),
        ],
        ...(index > 0 ? { pageBreak: 'before' as const } : {}),
      })),
      styles: {
        dayHeading: {
          bold: true,
          fontSize: 18,
          margin: [0, 0, 0, 10],
        },
        shiftHeading: {
          bold: true,
          fontSize: 12,
          margin: [SHIFT_INDENT, 0, 0, 5],
        },
        jobHeading: {
          bold: true,
          margin: [JOB_INDENT, 0, 0, 2],
        },
      },
    };
  }

  private groupShiftsByDay(
    shifts: WorkScheduleReportData['shifts']
  ): ReadonlyArray<readonly [DayOfWeek, ReadonlyArray<ScheduleShift>]> {
    const groups = new Map<DayOfWeek, ScheduleShift[]>();
    for (const shift of shifts) {
      const current = groups.get(shift.dayOfWeek) ?? [];
      current.push(shift);
      groups.set(shift.dayOfWeek, current);
    }
    return Array.from(groups.entries());
  }

  private buildDayContent(shifts: ReadonlyArray<ScheduleShift>): Content[] {
    const content: Content[] = [];

    for (let index = 0; index < shifts.length; index += 1) {
      const shift = shifts[index];
      const nextShift = shifts[index + 1];
      if (this.canRenderSideBySide(shift, nextShift)) {
        content.push(this.buildSideBySideLargeShifts(shift, nextShift));
        index += 1;
      } else {
        content.push(
          this.isLargeShift(shift) ? this.buildLargeShift(shift) : this.buildSmallShift(shift)
        );
      }
    }

    return content;
  }

  private canRenderSideBySide(
    shift: ScheduleShift,
    nextShift: ScheduleShift | undefined
  ): nextShift is ScheduleShift {
    return (
      nextShift !== undefined &&
      this.isLargeShift(shift) &&
      this.isLargeShift(nextShift) &&
      !this.hasRosterRequiringSplit(shift) &&
      !this.hasRosterRequiringSplit(nextShift) &&
      this.getEstimatedShiftColumnLines(shift) <= MAX_ESTIMATED_LINES_PER_SHIFT_COLUMN &&
      this.getEstimatedShiftColumnLines(nextShift) <= MAX_ESTIMATED_LINES_PER_SHIFT_COLUMN
    );
  }

  private buildSmallShift(shift: ScheduleShift): ContentStack {
    return {
      stack: [this.buildShiftHeading(shift), ...shift.jobs.map(job => this.buildSmallJob(job))],
      margin: [0, 0, 0, 10],
    };
  }

  private buildSmallJob(job: ScheduleJob): ContentStack {
    const assignedWorkers = job.registrations.map(registration =>
      this.formatUserName(registration.user)
    );
    const vacancyCount = Math.max(job.maxRegistrations - assignedWorkers.length, 0);
    const slots = [
      ...assignedWorkers,
      ...Array.from({ length: vacancyCount }, () => ' '),
    ];
    const isPageSized =
      this.getEstimatedJobLines(job.name, slots) <= MAX_ESTIMATED_LINES_PER_SHIFT_COLUMN;

    return {
      stack: [
        this.buildJobHeading(job),
        ...(slots.length > 0
          ? [
              {
                ul: slots,
                margin: [ROSTER_INDENT, 0, 0, 7],
              } as Content,
            ]
          : []),
      ],
      ...(isPageSized ? { unbreakable: true } : {}),
    };
  }

  private buildSideBySideLargeShifts(
    leftShift: ScheduleShift,
    rightShift: ScheduleShift
  ): ContentColumns {
    return {
      columns: [
        {
          width: '*',
          stack: this.buildLargeShiftStack(leftShift),
        },
        {
          width: '*',
          stack: this.buildLargeShiftStack(rightShift),
        },
      ],
      columnGap: 20,
      margin: [0, 0, 0, 10],
    };
  }

  private buildLargeShift(shift: ScheduleShift): ContentStack {
    return {
      stack: [this.buildShiftHeading(shift), ...this.buildShiftJobs(shift)],
      margin: [0, 0, 0, 10],
    };
  }

  private buildLargeShiftStack(shift: ScheduleShift): Content[] {
    return [this.buildShiftHeading(shift), ...this.buildShiftJobs(shift)];
  }

  private buildShiftJobs(shift: ScheduleShift): Content[] {
    return shift.jobs.flatMap(job =>
      this.isLargeJob(job) ? this.buildLargeJob(job) : [this.buildSmallJob(job)]
    );
  }

  private buildLargeJob(job: ScheduleJob): Content[] {
    const workers = this.getAssignedWorkerNames(job);
    if (workers.length > MAX_ROSTER_ITEMS_PER_COLUMN * 2) {
      return this.buildFlowingLargeJob(job, workers);
    }
    if (workers.length > MAX_ROSTER_ITEMS_PER_COLUMN) {
      return this.canSplitLargeJobIntoColumns(job, workers)
        ? [this.buildSplitLargeJob(job, workers)]
        : this.buildFlowingLargeJob(job, workers);
    }

    return this.getEstimatedJobLines(job.name, workers) <=
      MAX_ESTIMATED_LINES_PER_SHIFT_COLUMN
      ? [this.buildUnbreakableLargeJob(job, workers)]
      : this.buildFlowingLargeJob(job, workers);
  }

  private buildUnbreakableLargeJob(
    job: ScheduleJob,
    workers: ReadonlyArray<string>
  ): ContentStack {
    return {
      stack: [
        this.buildJobHeading(job),
        ...(workers.length > 0 ? [this.buildNumberedRoster(workers, 1)] : []),
      ],
      unbreakable: true,
    };
  }

  private buildFlowingLargeJob(
    job: ScheduleJob,
    workers: ReadonlyArray<string>
  ): Content[] {
    return [
      this.buildJobHeading(job),
      ...(workers.length > 0 ? [this.buildNumberedRoster(workers, 1)] : []),
    ];
  }

  private canSplitLargeJobIntoColumns(
    job: ScheduleJob,
    workers: ReadonlyArray<string>
  ): boolean {
    const midpoint = Math.ceil(workers.length / 2);
    return (
      this.getEstimatedJobLines(job.name, workers.slice(0, midpoint)) <=
        MAX_ESTIMATED_LINES_PER_SHIFT_COLUMN &&
      this.getEstimatedJobLines(
        `${job.name} (continued)`,
        workers.slice(midpoint)
      ) <= MAX_ESTIMATED_LINES_PER_SHIFT_COLUMN
    );
  }

  private buildSplitLargeJob(
    job: ScheduleJob,
    workers: ReadonlyArray<string>
  ): ContentColumns {
    const midpoint = Math.ceil(workers.length / 2);
    return {
      columns: [
        {
          width: '*',
          stack: [
            this.buildJobHeading(job),
            this.buildNumberedRoster(workers.slice(0, midpoint), 1),
          ],
        },
        {
          width: '*',
          stack: [
            this.buildJobHeading(job, true),
            this.buildNumberedRoster(workers.slice(midpoint), midpoint + 1),
          ],
        },
      ],
      columnGap: 20,
    };
  }

  private buildNumberedRoster(workers: ReadonlyArray<string>, start: number): Content {
    return {
      ol: [...workers],
      start,
      margin: [ROSTER_INDENT, 0, 0, 5],
    };
  }

  private buildJobHeading(job: ScheduleJob, continued = false): Content {
    return {
      text: continued ? `${job.name} (continued)` : job.name,
      style: 'jobHeading',
    };
  }

  private buildShiftHeading(shift: ScheduleShift): Content {
    return {
      text: `${shift.name} - ${shift.startTime} - ${shift.endTime}`,
      style: 'shiftHeading',
    };
  }

  private isLargeShift(shift: ScheduleShift): boolean {
    return shift.jobs.some(job => this.isLargeJob(job));
  }

  private isLargeJob(job: ScheduleJob): boolean {
    return job.maxRegistrations > MAX_BULLETED_SHIFT_CAPACITY;
  }

  private hasRosterRequiringSplit(shift: ScheduleShift): boolean {
    return shift.jobs.some(
      job => job.registrations.length > MAX_ROSTER_ITEMS_PER_COLUMN
    );
  }

  private getEstimatedShiftColumnLines(shift: ScheduleShift): number {
    const shiftHeading = `${shift.name} - ${shift.startTime} - ${shift.endTime}`;
    return shift.jobs.reduce(
      (lineCount, job) =>
        lineCount +
        this.getEstimatedTextLines(job.name) +
        1 +
        this.getEstimatedRosterLines(job),
      this.getEstimatedTextLines(shiftHeading)
    );
  }

  private getEstimatedRosterLines(job: ScheduleJob): number {
    const assignedNames = this.getAssignedWorkerNames(job);
    const assignedLines = assignedNames.reduce(
      (lineCount, name) => lineCount + this.getEstimatedTextLines(name),
      0
    );
    if (this.isLargeJob(job)) {
      return assignedLines;
    }

    const vacancyCount = Math.max(job.maxRegistrations - assignedNames.length, 0);
    return assignedLines + vacancyCount;
  }

  private getEstimatedJobLines(
    heading: string,
    rosterItems: ReadonlyArray<string>
  ): number {
    const rosterLines = rosterItems.reduce(
      (lineCount, item) => lineCount + this.getEstimatedTextLines(item),
      0
    );
    return this.getEstimatedTextLines(heading) + 1 + rosterLines;
  }

  private getEstimatedTextLines(text: string): number {
    return Math.max(Math.ceil(text.length / ESTIMATED_CHARACTERS_PER_COLUMN_LINE), 1);
  }

  private getAssignedWorkerNames(job: ScheduleJob): string[] {
    return job.registrations.map(registration => this.formatUserName(registration.user));
  }

  private formatUserName(user: {
    readonly firstName: string;
    readonly lastName: string;
    readonly playaName: string | null;
  }): string {
    const fullName = `${user.firstName} ${user.lastName}`;
    return user.playaName ? `${fullName} (${user.playaName})` : fullName;
  }
}
