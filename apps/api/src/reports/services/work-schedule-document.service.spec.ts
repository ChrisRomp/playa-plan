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
    const job = shift.stack[1] as ContentStack;
    const roster = job.stack[1] as { ul: string[] };

    expect(actualDocument.pageOrientation).toBe('portrait');
    expect(actualDocument.info?.title).toBe('Burning Sky Work Schedule 2026');
    expect(actualDocument.styles?.shiftHeading).toEqual(
      expect.objectContaining({ margin: [18, 0, 0, 5] })
    );
    expect(actualDocument.styles?.jobHeading).toEqual(
      expect.objectContaining({ margin: [30, 0, 0, 2] })
    );
    expect(roster).toEqual(expect.objectContaining({ margin: [44, 0, 0, 7] }));
    expect(roster.ul).toEqual(['Worker 1 Last 1 (Playa 1)', ' ', ' ']);
  });

  it('shouldKeepTenCapacitySlotsInBulletedCapacityFormatting', () => {
    const actualDocument = service.build(
      createReportData([
        createShift('teardown', 6, 10),
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;
    const job = shift.stack[1] as ContentStack;
    const roster = job.stack[1] as { ul: string[] };

    expect(roster.ul).toHaveLength(10);
    expect(roster.ul.filter(worker => worker === ' ')).toHaveLength(4);
  });

  it('shouldSwitchToAnAssignedOnlyNumberedRosterAboveTenCapacitySlots', () => {
    const actualDocument = service.build(
      createReportData([
        createShift('teardown', 7, 50),
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;
    const job = shift.stack[1] as ContentStack;
    const jobHeading = job.stack[0] as { text: string };
    const roster = job.stack[1] as { ol: string[]; start: number };

    expect(job.unbreakable).toBe(true);
    expect(jobHeading.text).toBe('Teardown');
    expect(roster.ol).toHaveLength(7);
    expect(roster.ol).not.toContain(' ');
    expect(roster.start).toBe(1);
  });

  it('shouldApplyTheThresholdToEachJobInsteadOfTotalShiftCapacity', () => {
    const inputShift = createShift('wednesday-am', 0, 4);
    const inputSecondJob = createShift('art-car', 2, 7).jobs[0];
    const actualDocument = service.build(
      createReportData([
        {
          ...inputShift,
          jobs: [
            inputShift.jobs[0],
            {
              ...inputSecondJob,
              name: 'Art Car',
            },
          ],
        },
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;
    const firstJob = shift.stack[1] as ContentStack;
    const secondJob = shift.stack[2] as ContentStack;
    const firstRoster = firstJob.stack[1] as { ul: string[] };
    const secondRoster = secondJob.stack[1] as { ul: string[] };

    expect(firstRoster.ul).toEqual([' ', ' ', ' ', ' ']);
    expect(secondRoster.ul).toHaveLength(7);
    expect(secondRoster.ul.filter(worker => worker === ' ')).toHaveLength(5);
  });

  it('shouldAllowSmallShiftsToBreakBetweenJobs', () => {
    const inputShift = createShift('wednesday-am', 0, 10);
    const actualDocument = service.build(
      createReportData([
        {
          ...inputShift,
          jobs: Array.from({ length: 6 }, (_, index) => ({
            ...inputShift.jobs[0],
            id: `job-${index + 1}`,
            name: `Job ${index + 1}`,
          })),
        },
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;
    const jobs = shift.stack.slice(1) as ContentStack[];

    expect(shift.unbreakable).toBeUndefined();
    expect(jobs).toHaveLength(6);
    expect(jobs.every(job => job.unbreakable === true)).toBe(true);
  });

  it('shouldPreserveTheSuppliedShiftOrderAcrossSmallAndLargeJobs', () => {
    const actualDocument = service.build(
      createReportData([
        {
          ...createShift('full', 0, 1),
          name: 'Wednesday Full',
          startTime: '09:00',
        },
        {
          ...createShift('am', 7, 50),
          name: 'Wednesday AM',
          startTime: '09:30',
        },
        {
          ...createShift('afternoon', 0, 1),
          name: 'Wednesday PM',
          startTime: '14:00',
        },
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shiftHeadings = day.stack.slice(1).map(content => {
      const shift = content as ContentStack;
      return (shift.stack[0] as { text: string }).text;
    });

    expect(shiftHeadings).toEqual([
      'Wednesday Full - 09:00 - 13:00',
      'Wednesday AM - 09:30 - 13:00',
      'Wednesday PM - 14:00 - 18:00',
    ]);
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
    const leftJob = (columns.columns[0] as ContentStack).stack[1] as ContentStack;
    const rightJob = (columns.columns[1] as ContentStack).stack[1] as ContentStack;

    expect(columns.columns).toHaveLength(2);
    expect(leftJob.stack[1]).toEqual(
      expect.objectContaining({ ol: expect.any(Array), start: 1 })
    );
    expect(rightJob.stack[1]).toEqual(
      expect.objectContaining({ ol: expect.any(Array), start: 1 })
    );
  });

  it('shouldFormatLargeAndSmallJobsIndependentlyWithinOneShift', () => {
    const inputShift = createShift('teardown', 6, 50);
    const inputSecondJob = createShift('cleanup', 1, 3).jobs[0];
    const actualDocument = service.build(
      createReportData([
        {
          ...inputShift,
          jobs: [
            inputShift.jobs[0],
            {
              ...inputSecondJob,
              name: 'Cleanup',
            },
          ],
        },
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;
    const largeJob = shift.stack[1] as ContentStack;
    const smallJob = shift.stack[2] as ContentStack;

    expect(largeJob.stack[0]).toEqual(expect.objectContaining({ text: 'Teardown' }));
    expect(largeJob.stack[1]).toEqual(
      expect.objectContaining({ ol: expect.any(Array), start: 1 })
    );
    expect(smallJob.stack[0]).toEqual(expect.objectContaining({ text: 'Cleanup' }));
    expect(smallJob.stack[1]).toEqual(
      expect.objectContaining({ ul: expect.any(Array) })
    );
    expect((smallJob.stack[1] as { ul: string[] }).ul).toHaveLength(3);
  });

  it('shouldNotPairShiftsWhenVacantSlotsWouldOverflowAColumn', () => {
    const inputShift = createShift('morning', 1, 50);
    const inputSmallJob = createShift('small', 0, 10).jobs[0];
    const actualDocument = service.build(
      createReportData([
        {
          ...inputShift,
          jobs: [
            inputShift.jobs[0],
            ...Array.from({ length: 5 }, (_, index) => ({
              ...inputSmallJob,
              id: `small-job-${index + 1}`,
              name: `Small Job ${index + 1}`,
            })),
          ],
        },
        createShift('afternoon', 16, 20),
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;

    expect(day.stack).toHaveLength(3);
    expect((day.stack[1] as ContentStack).stack[0]).toEqual(
      expect.objectContaining({ text: 'Sunday AM - 10:00 - 13:00' })
    );
    expect((day.stack[2] as ContentStack).stack[0]).toEqual(
      expect.objectContaining({ text: 'Sunday PM - 15:00 - 18:00' })
    );
  });

  it('shouldNotPairShiftsWhenJobHeadingsWouldOverflowAColumn', () => {
    const inputShift = createShift('morning', 0, 50);
    const inputEmptyJob = createShift('empty', 0, 0).jobs[0];
    const actualDocument = service.build(
      createReportData([
        {
          ...inputShift,
          jobs: [
            inputShift.jobs[0],
            ...Array.from({ length: 22 }, (_, index) => ({
              ...inputEmptyJob,
              id: `empty-job-${index + 1}`,
              name: `Empty Job ${index + 1}`,
            })),
          ],
        },
        createShift('afternoon', 16, 20),
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;

    expect(day.stack).toHaveLength(3);
  });

  it('shouldLetWrappedPageSizedRostersFlowAcrossPages', () => {
    const inputShift = createShift('teardown', 22, 50);
    const inputJob = inputShift.jobs[0];
    const actualDocument = service.build(
      createReportData([
        {
          ...inputShift,
          jobs: [
            {
              ...inputJob,
              registrations: inputJob.registrations.map(registration => ({
                ...registration,
                user: {
                  ...registration.user,
                  firstName: 'Extraordinarily Long Worker First Name',
                  lastName: 'Extraordinarily Long Worker Last Name',
                },
              })),
            },
          ],
        },
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;

    expect(shift.stack[1]).toEqual(expect.objectContaining({ text: 'Teardown' }));
    expect(shift.stack[2]).toEqual(
      expect.objectContaining({ ol: expect.any(Array), start: 1 })
    );
  });

  it('shouldNotPairShiftsWhenWorkerNamesWrapAcrossLines', () => {
    const inputShift = createShift('morning', 22, 50);
    const inputJob = inputShift.jobs[0];
    const actualDocument = service.build(
      createReportData([
        {
          ...inputShift,
          jobs: [
            {
              ...inputJob,
              registrations: inputJob.registrations.map(registration => ({
                ...registration,
                user: {
                  ...registration.user,
                  firstName: 'Extraordinarily Long Worker First Name',
                  lastName: 'Extraordinarily Long Worker Last Name',
                },
              })),
            },
          ],
        },
        createShift('afternoon', 16, 20),
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;

    expect(day.stack).toHaveLength(3);
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
    const left = (columns.columns[0] as ContentStack).stack[1] as {
      ol: string[];
      start: number;
    };
    const rightHeading = (columns.columns[1] as ContentStack).stack[0] as {
      text: string;
    };
    const right = (columns.columns[1] as ContentStack).stack[1] as {
      ol: string[];
      start: number;
    };

    expect(left.ol).toHaveLength(25);
    expect(left.start).toBe(1);
    expect(rightHeading.text).toBe('Teardown (continued)');
    expect(right.ol).toHaveLength(25);
    expect(right.start).toBe(26);
  });

  it('shouldNotSplitWrappedRostersIntoFixedColumns', () => {
    const inputShift = createShift('teardown', 50, 60);
    const inputJob = inputShift.jobs[0];
    const actualDocument = service.build(
      createReportData([
        {
          ...inputShift,
          jobs: [
            {
              ...inputJob,
              registrations: inputJob.registrations.map(registration => ({
                ...registration,
                user: {
                  ...registration.user,
                  firstName: 'Extraordinarily Long Worker First Name',
                  lastName: 'Extraordinarily Long Worker Last Name',
                },
              })),
            },
          ],
        },
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;
    const roster = shift.stack[2] as { ol: string[]; start: number };

    expect(shift.stack[1]).toEqual(expect.objectContaining({ text: 'Teardown' }));
    expect(roster.ol).toHaveLength(50);
    expect(roster.start).toBe(1);
  });

  it('shouldLetRostersLargerThanTwoColumnsFlowAcrossPages', () => {
    const actualDocument = service.build(
      createReportData([
        createShift('teardown', 85, 100),
      ])
    );
    const day = (actualDocument.content as Content[])[0] as ContentStack;
    const shift = day.stack[1] as ContentStack;
    const jobHeading = shift.stack[1] as { text: string };
    const roster = shift.stack[2] as { ol: string[]; start: number };

    expect(jobHeading.text).toBe('Teardown');
    expect(roster.ol).toHaveLength(85);
    expect(roster.start).toBe(1);
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
