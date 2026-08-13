import { DayOfWeek } from '@prisma/client';
import { Content, ContentColumns, ContentStack } from 'pdfmake/interfaces';
import { WorkScheduleReportData } from '../models/work-schedule-report-data';
import { WorkScheduleDocumentService } from './work-schedule-document.service';

describe('WorkScheduleDocumentService', () => {
  const service = new WorkScheduleDocumentService();

  it('shouldRenderSmallJobsWithAssignedAndVacantBulletSlots', () => {
    const actualDocument = service.build(
      createReportData([
        createShift('morning', 1, 3),
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;
    const roster = shift.stack[2] as { ul: string[] };

    expect(actualDocument.pageOrientation).toBe('portrait');
    expect(actualDocument.info?.title).toBe('Burning Sky Work Schedule 2026');
    expect(roster.ul).toEqual(['Worker 1 Last 1 (Playa 1)', ' ', ' ']);
  });

  it('shouldSwitchToAnAssignedOnlyNumberedRosterAtTenWorkers', () => {
    const actualDocument = service.build(
      createReportData([
        createShift('teardown', 10, 20),
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;
    const roster = shift.stack[1] as { ol: string[]; start: number };

    expect(roster.ol).toHaveLength(10);
    expect(roster.ol).not.toContain(' ');
    expect(roster.start).toBe(1);
  });

  it('shouldPlaceTwoLargeShiftsSideBySideWhenEachFitsAColumn', () => {
    const actualDocument = service.build(
      createReportData([
        createShift('morning', 40, 50),
        createShift('afternoon', 16, 20),
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const columns = day.stack[1] as ContentColumns;

    expect(columns.columns).toHaveLength(2);
    expect((columns.columns[0] as ContentStack).stack[1]).toEqual(
      expect.objectContaining({ ol: expect.any(Array), start: 1 })
    );
    expect((columns.columns[1] as ContentStack).stack[1]).toEqual(
      expect.objectContaining({ ol: expect.any(Array), start: 1 })
    );
  });

  it('shouldSplitAnOversizedRosterIntoContinuouslyNumberedColumns', () => {
    const actualDocument = service.build(
      createReportData([
        createShift('teardown', 50, 60),
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;
    const columns = shift.stack[1] as ContentColumns;
    const left = (columns.columns[0] as ContentStack).stack[0] as {
      ol: string[];
      start: number;
    };
    const right = (columns.columns[1] as ContentStack).stack[0] as {
      ol: string[];
      start: number;
    };

    expect(left.ol).toHaveLength(25);
    expect(left.start).toBe(1);
    expect(right.ol).toHaveLength(25);
    expect(right.start).toBe(26);
  });

  function createReportData(
    shifts: WorkScheduleReportData['shifts']
  ): WorkScheduleReportData {
    return {
      campName: 'Burning Sky',
      year: 2026,
      shifts,
    };
  }

  function createShift(
    id: string,
    workerCount: number,
    maxRegistrations: number
  ): WorkScheduleReportData['shifts'][number] {
    return {
      id,
      name: id === 'afternoon' ? 'Sunday PM' : 'Sunday AM',
      dayOfWeek: DayOfWeek.CLOSING_SUNDAY,
      startTime: id === 'afternoon' ? '15:00' : '10:00',
      endTime: id === 'afternoon' ? '18:00' : '13:00',
      jobs: [
        {
          id: `${id}-job`,
          name: 'Teardown',
          location: 'Camp',
          maxRegistrations,
          categoryId: 'category',
          category: { id: 'category', name: 'Operations' },
          registrations: Array.from({ length: workerCount }, (_, index) => ({
            id: `${id}-registration-${index + 1}`,
            user: {
              id: `${id}-user-${index + 1}`,
              firstName: `Worker ${index + 1}`,
              lastName: `Last ${index + 1}`,
              playaName: `Playa ${index + 1}`,
            },
          })),
        },
      ],
    };
  }
});
