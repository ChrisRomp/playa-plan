import { Injectable } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { Content, ContentColumns, ContentStack, TDocumentDefinitions } from 'pdfmake/interfaces';
import { WorkScheduleReportData } from '../models/work-schedule-report-data';

const LARGE_SHIFT_ASSIGNMENT_THRESHOLD = 10;
const MAX_ROSTER_ITEMS_PER_COLUMN = 42;
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
          margin: [0, 0, 0, 5],
        },
        jobHeading: {
          bold: true,
          margin: [0, 0, 0, 2],
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
      {
        text: job.name,
        style: 'jobHeading',
      },
      ...(slots.length > 0
        ? [
            {
              ul: slots,
              margin: [14, 0, 0, 7],
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
        ? [this.buildNumberedRoster(workers, 1)]
        : this.buildSplitRoster(workers);

    return {
      stack: [this.buildShiftHeading(shift), ...roster],
      margin: [0, 0, 0, 10],
    };
  }

  private buildLargeShiftStack(shift: ScheduleShift): Content[] {
    return [
      this.buildShiftHeading(shift),
      this.buildNumberedRoster(this.getAssignedWorkers(shift), 1),
    ];
  }

  private buildSplitRoster(workers: ReadonlyArray<string>): ContentColumns[] {
    const midpoint = Math.ceil(workers.length / 2);
    return [
      {
        columns: [
          {
            width: '*',
            stack: [this.buildNumberedRoster(workers.slice(0, midpoint), 1)],
          },
          {
            width: '*',
            stack: [
              this.buildNumberedRoster(workers.slice(midpoint), midpoint + 1),
            ],
          },
        ],
        columnGap: 20,
      },
    ];
  }

  private buildNumberedRoster(workers: ReadonlyArray<string>, start: number): Content {
    return {
      ol: [...workers],
      start,
      margin: [14, 0, 0, 5],
    };
  }

  private buildShiftHeading(shift: ScheduleShift): Content {
    return {
      text: `${shift.name} - ${shift.startTime} - ${shift.endTime}`,
      style: 'shiftHeading',
    };
  }

  private isLargeShift(shift: ScheduleShift): boolean {
    return this.getAssignedWorkers(shift).length >= LARGE_SHIFT_ASSIGNMENT_THRESHOLD;
  }

  private getAssignedWorkers(shift: ScheduleShift): string[] {
    const includeJobName = shift.jobs.length > 1;
    return shift.jobs.flatMap(job =>
      job.registrations.map(registration => {
        const name = this.formatUserName(registration.user);
        return includeJobName ? `${name} - ${job.name}` : name;
      })
    );
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
