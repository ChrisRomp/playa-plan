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

  it('should include conflicts from the shared schedule analyzer', () => {
    const first = createJob('first', 'FRIDAY', '09:00', '11:00');
    const second = createJob('second', 'FRIDAY', '10:00', '12:00');
    const actualAnalysis = service.analyze({
      jobs: [first, second],
      allowNoJob: false,
      campingOptions: [],
      alwaysRequiredCategories: [],
    });

    expect(actualAnalysis.conflicts).toHaveLength(1);
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
