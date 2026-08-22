import { RegistrationJobSelectionService } from './registration-job-selection.service';

describe('RegistrationJobSelectionService', () => {
  const service = new RegistrationJobSelectionService();

  const createJob = (
    id: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    shiftId = `shift-${id}`,
  ) => ({
    id,
    name: `Job ${id}`,
    shift: {
      id: shiftId,
      name: `Shift ${id}`,
      dayOfWeek,
      startTime,
      endTime,
    },
  });

  it.each([
    {
      name: 'same shift',
      first: createJob('first', 'FRIDAY', '09:00', '10:00', 'shared-shift'),
      second: createJob('second', 'FRIDAY', '09:00', '10:00', 'shared-shift'),
      expectedConflicts: 1,
    },
    {
      name: 'partial overlap',
      first: createJob('first', 'FRIDAY', '09:00', '11:00'),
      second: createJob('second', 'FRIDAY', '10:00', '12:00'),
      expectedConflicts: 1,
    },
    {
      name: 'contained overlap',
      first: createJob('first', 'FRIDAY', '09:00', '13:00'),
      second: createJob('second', 'FRIDAY', '10:00', '12:00'),
      expectedConflicts: 1,
    },
    {
      name: 'touching boundary',
      first: createJob('first', 'FRIDAY', '09:00', '10:00'),
      second: createJob('second', 'FRIDAY', '10:00', '11:00'),
      expectedConflicts: 0,
    },
    {
      name: 'overnight overlap',
      first: createJob('first', 'FRIDAY', '23:00', '01:00'),
      second: createJob('second', 'SATURDAY', '00:30', '02:00'),
      expectedConflicts: 1,
    },
    {
      name: '24-hour shift',
      first: createJob('first', 'FRIDAY', '09:00', '09:00'),
      second: createJob('second', 'SATURDAY', '08:00', '10:00'),
      expectedConflicts: 1,
    },
    {
      name: 'different non-overlapping days',
      first: createJob('first', 'FRIDAY', '09:00', '10:00'),
      second: createJob('second', 'SATURDAY', '09:00', '10:00'),
      expectedConflicts: 0,
    },
    {
      name: 'ignored pre-opening bucket',
      first: createJob('first', 'PRE_OPENING', '09:00', '12:00', 'shared-shift'),
      second: createJob('second', 'PRE_OPENING', '10:00', '11:00', 'shared-shift'),
      expectedConflicts: 0,
    },
    {
      name: 'ignored post-event bucket',
      first: createJob('first', 'POST_EVENT', '09:00', '12:00'),
      second: createJob('second', 'POST_EVENT', '10:00', '11:00'),
      expectedConflicts: 0,
    },
  ])('should analyze $name correctly', ({ first, second, expectedConflicts }) => {
    const actualAnalysis = service.analyze({
      jobs: [first, second],
      allowNoJob: false,
      campingOptions: [],
      alwaysRequiredCategories: [],
    });

    expect(actualAnalysis.conflicts).toHaveLength(expectedConflicts);
  });

  it('should calculate camping and always-required counts', () => {
    const actualAnalysis = service.analyze({
      jobs: [
        createJob('first', 'FRIDAY', '09:00', '10:00'),
        createJob('second', 'SATURDAY', '09:00', '10:00'),
        createJob('third', 'CLOSING_SUNDAY', '09:00', '10:00'),
        createJob('fourth', 'MONDAY', '09:00', '10:00'),
      ],
      allowNoJob: false,
      campingOptions: [{ workShiftsRequired: 2 }],
      alwaysRequiredCategories: [{ id: 'always-required' }],
    });

    expect(actualAnalysis).toMatchObject({
      selectedCount: 4,
      requiredCount: 3,
      extraCount: 1,
    });
  });

  it('should require zero jobs when allowNoJob is enabled', () => {
    const actualAnalysis = service.analyze({
      jobs: [createJob('first', 'FRIDAY', '09:00', '10:00')],
      allowNoJob: true,
      campingOptions: [{ workShiftsRequired: 2 }],
      alwaysRequiredCategories: [{ id: 'always-required' }],
    });

    expect(actualAnalysis).toMatchObject({
      selectedCount: 1,
      requiredCount: 0,
      extraCount: 1,
    });
  });
});
