import { Injectable } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { Content, ContentColumns, ContentStack, TDocumentDefinitions } from 'pdfmake/interfaces';
import { WorkScheduleReportData } from '../models/work-schedule-report-data';

const MAX_BULLETED_SHIFT_ASSIGNMENTS = 10;
const MAX_ROSTER_ITEMS_PER_COLUMN = 42;
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
    const smallShifts = shifts.filter(shift => !this.isLargeShift(shift));
    const largeShifts = shifts.filter(shift => this.isLargeShift(shift));
    const content: Content[] = smallShifts.map(shift => this.buildSmallShift(shift));

    if (
      largeShifts.length === 2 &&
      largeShifts.every(
        shift => this.getAssignedWorkers(shift).length <= MAX_ROSTER_ITEMS_PER_COLUMN
      )
    ) {
      content.push(this.buildSideBySideLargeShifts(largeShifts[0], largeShifts[1]));
      return content;
    }

    content.push(...largeShifts.map(shift => this.buildLargeShift(shift)));
    return content;
  }

  private buildSmallShift(shift: ScheduleShift): ContentStack {
    return {
      stack: [
        this.buildShiftHeading(shift),
        ...shift.jobs.flatMap(job => this.buildSmallJob(job)),
      ],
      margin: [0, 0, 0, 10],
      unbreakable: true,
    };
  }

  private buildSmallJob(job: ScheduleJob): Content[] {
    const assignedWorkers = job.registrations.map(registration =>
      this.formatUserName(registration.user)
    );
    const vacancyCount = Math.max(job.maxRegistrations - assignedWorkers.length, 0);
    const slots = [
      ...assignedWorkers,
      ...Array.from({ length: vacancyCount }, () => ' '),
    ];

    return [
      this.buildJobHeading(job),
      ...(slots.length > 0
        ? [
            {
              ul: slots,
              margin: [ROSTER_INDENT, 0, 0, 7],
            } as Content,
          ]
        : []),
    ];
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
    const workers = this.getAssignedWorkers(shift);
    const roster =
      workers.length <= MAX_ROSTER_ITEMS_PER_COLUMN
        ? this.buildLargeJobSections(shift, 0, workers.length)
        : [this.buildSplitRoster(shift, workers.length)];

    return {
      stack: [this.buildShiftHeading(shift), ...roster],
      margin: [0, 0, 0, 10],
    };
  }

  private buildLargeShiftStack(shift: ScheduleShift): Content[] {
    return [
      this.buildShiftHeading(shift),
      ...this.buildLargeJobSections(shift, 0, this.getAssignedWorkers(shift).length),
    ];
  }

  private buildSplitRoster(shift: ScheduleShift, workerCount: number): ContentColumns {
    const midpoint = Math.ceil(workerCount / 2);
    return {
      columns: [
        {
          width: '*',
          stack: this.buildLargeJobSections(shift, 0, midpoint),
        },
        {
          width: '*',
          stack: this.buildLargeJobSections(shift, midpoint, workerCount),
        },
      ],
      columnGap: 20,
    };
  }

  private buildLargeJobSections(
    shift: ScheduleShift,
    rangeStart: number,
    rangeEnd: number
  ): Content[] {
    const content: Content[] = [];
    let workerOffset = 0;

    for (const job of shift.jobs) {
      const workers = this.getAssignedWorkerNames(job);
      const jobStart = workerOffset;
      const jobEnd = jobStart + workers.length;
      const sliceStart = Math.max(rangeStart, jobStart);
      const sliceEnd = Math.min(rangeEnd, jobEnd);

      if (sliceStart < sliceEnd) {
        content.push(
          this.buildJobHeading(job, sliceStart > jobStart),
          this.buildNumberedRoster(
            workers.slice(sliceStart - jobStart, sliceEnd - jobStart),
            sliceStart + 1
          )
        );
      }

      workerOffset = jobEnd;
    }

    return content;
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
    return this.getAssignedWorkers(shift).length > MAX_BULLETED_SHIFT_ASSIGNMENTS;
  }

  private getAssignedWorkers(shift: ScheduleShift): string[] {
    return shift.jobs.flatMap(job => this.getAssignedWorkerNames(job));
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
