import { act, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegistrationPage from './RegistrationPage';
import { AuthContext } from '../../store/authUtils';
import { api, jobCategories, jobs, shifts } from '../../lib/api';
import { useCampingOptions } from '../../hooks/useCampingOptions';
import { useProfile } from '../../hooks/useProfile';
import { useCampRegistration } from '../../hooks/useCampRegistration';
import { useConfig } from '../../hooks/useConfig';
import { useMyRegistration } from '../../hooks/useMyRegistration';

vi.mock('../../hooks/useCampingOptions', () => ({ useCampingOptions: vi.fn() }));
vi.mock('../../hooks/useProfile', () => ({ useProfile: vi.fn() }));
vi.mock('../../hooks/useCampRegistration', () => ({ useCampRegistration: vi.fn() }));
vi.mock('../../hooks/useConfig', () => ({ useConfig: vi.fn() }));
vi.mock('../../hooks/useMyRegistration', () => ({ useMyRegistration: vi.fn() }));
vi.mock('../../components/payment/PaymentButton', () => ({ default: () => null }));
vi.mock('../../lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
    },
    jobCategories: {
      ...actual.jobCategories,
      getAll: vi.fn(),
    },
    jobs: {
      ...actual.jobs,
      getAll: vi.fn(),
    },
    shifts: {
      ...actual.shifts,
      getAll: vi.fn(),
    },
  };
});

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>(resolve => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: resolvePromise,
  };
}

describe('RegistrationPage job loading integration', () => {
  const teardownCategory = {
    id: 'teardown',
    name: 'Teardown',
    description: 'Help break down camp',
    alwaysRequired: true,
    staffOnly: false,
  };
  const manifestCategory = {
    id: 'manifest',
    name: 'Manifest Assistant',
    description: 'Help manifest loads',
    alwaysRequired: false,
    staffOnly: false,
  };
  const unrelatedCategory = {
    id: 'unrelated',
    name: 'Unrelated Work',
    description: 'Not configured for Skydiving',
    alwaysRequired: false,
    staffOnly: false,
  };
  const skydivingOption = {
    id: 'skydiving',
    name: 'Skydiving',
    description: 'Skydiving camp option',
    enabled: true,
    workShiftsRequired: 1,
    participantDues: 850,
    staffDues: 850,
    maxSignups: 60,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobCategoryIds: [manifestCategory.id, teardownCategory.id],
  };
  const testShifts = [
    {
      id: 'manifest-shift',
      name: 'Wednesday AM',
      description: 'Wednesday morning',
      startTime: '09:30',
      endTime: '14:30',
      dayOfWeek: 'WEDNESDAY',
    },
    {
      id: 'teardown-shift',
      name: 'Closing Sunday',
      description: 'Closing Sunday morning',
      startTime: '10:00',
      endTime: '13:00',
      dayOfWeek: 'CLOSING_SUNDAY',
    },
    {
      id: 'unrelated-shift',
      name: 'Monday AM',
      description: 'Monday morning',
      startTime: '09:00',
      endTime: '12:00',
      dayOfWeek: 'MONDAY',
    },
  ];
  const testJobs = [
    {
      id: 'manifest-job',
      name: 'Manifest Assistant - Wednesday AM',
      location: 'Manifest',
      active: true,
      categoryId: manifestCategory.id,
      category: manifestCategory,
      shiftId: testShifts[0].id,
      maxRegistrations: 3,
      currentRegistrations: 0,
      staffOnly: false,
      alwaysRequired: false,
    },
    {
      id: 'teardown-job',
      name: 'Teardown Morning',
      location: 'Camp',
      active: true,
      categoryId: teardownCategory.id,
      category: teardownCategory,
      shiftId: testShifts[1].id,
      maxRegistrations: 50,
      currentRegistrations: 10,
      staffOnly: false,
      alwaysRequired: true,
    },
    {
      id: 'unrelated-job',
      name: 'Unrelated Job',
      location: 'Camp',
      active: true,
      categoryId: unrelatedCategory.id,
      category: unrelatedCategory,
      shiftId: testShifts[2].id,
      maxRegistrations: 10,
      currentRegistrations: 0,
      staffOnly: false,
      alwaysRequired: false,
    },
  ];

  let campRegistrationState: ReturnType<typeof useCampRegistration>;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useConfig).mockReturnValue({
      config: {
        name: 'Test Camp',
        description: 'Test camp',
        homePageBlurb: 'Test',
        registrationOpen: true,
        earlyRegistrationOpen: false,
        currentYear: 2026,
        registrationTerms: '<p>Terms</p>',
        applicationApprovalRequired: true,
      },
      isLoading: false,
      error: null,
      refreshConfig: vi.fn(),
      isConnecting: false,
      isConnected: true,
      connectionError: null,
    });
    vi.mocked(useProfile).mockReturnValue({
      profile: {
        id: 'user-1',
        email: 'participant@example.com',
        firstName: 'Test',
        lastName: 'Participant',
        playaName: '',
        phone: '555-1234',
        city: '',
        stateProvince: '',
        country: '',
        emergencyContact: 'Emergency Contact',
        role: 'PARTICIPANT',
        isEmailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isProfileComplete: true,
      },
      updateProfile: vi.fn(),
      isLoading: false,
      error: null,
      isProfileComplete: true,
    });
    vi.mocked(useMyRegistration).mockReturnValue({
      registration: {
        id: 'registration-1',
        status: 'APPLICATION_APPROVED',
        year: 2026,
        createdAt: '2026-08-12T00:00:00.000Z',
        jobs: [],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.mocked(useCampingOptions).mockReturnValue({
      options: [],
      selectedOption: null,
      fields: [],
      loading: false,
      error: null,
      loadCampingOptions: vi.fn(),
      loadCampingOption: vi.fn(),
      createCampingOption: vi.fn(),
      updateCampingOption: vi.fn(),
      deleteCampingOption: vi.fn(),
      loadCampingOptionFields: vi.fn().mockResolvedValue([]),
      createCampingOptionField: vi.fn(),
      updateCampingOptionField: vi.fn(),
      deleteCampingOptionField: vi.fn(),
    });

    campRegistrationState = {
      campRegistration: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    };
    vi.mocked(useCampRegistration).mockImplementation(() => campRegistrationState);

    vi.mocked(jobCategories.getAll).mockResolvedValue([
      teardownCategory,
      manifestCategory,
      unrelatedCategory,
    ]);
    vi.mocked(jobs.getAll).mockResolvedValue(testJobs);
    vi.mocked(shifts.getAll).mockResolvedValue(testShifts);
  });

  it('should fetch jobs once and derive camp jobs after approved option hydration', async () => {
    const campingOptionsResponse = createDeferred<{ data: typeof skydivingOption[] }>();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/camping-options') {
        return campingOptionsResponse.promise;
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    const authValue = {
      user: {
        id: 'user-1',
        email: 'participant@example.com',
        firstName: 'Test',
        lastName: 'Participant',
        role: 'user' as const,
        isAuthenticated: true,
        isEarlyRegistrationEnabled: false,
        hasRegisteredForCurrentYear: false,
      },
      requestVerificationCode: vi.fn(),
      verifyCode: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
      error: null,
      isAuthenticated: true,
      isConnecting: false,
      isConnected: true,
      connectionError: null,
    };

    const view = render(
      <BrowserRouter>
        <AuthContext.Provider value={authValue}>
          <RegistrationPage />
        </AuthContext.Provider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(jobs.getAll).toHaveBeenCalledTimes(1);
      expect(jobCategories.getAll).toHaveBeenCalledTimes(1);
    });

    campRegistrationState = {
      campRegistration: {
        campingOptions: [{ campingOptionId: skydivingOption.id }],
        customFieldValues: [],
        jobRegistrations: [],
        hasRegistration: true,
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    };

    view.rerender(
      <BrowserRouter>
        <AuthContext.Provider value={authValue}>
          <RegistrationPage />
        </AuthContext.Provider>
      </BrowserRouter>
    );

    expect(screen.getByText('Loading registration...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();

    await act(async () => {
      campingOptionsResponse.resolve({ data: [skydivingOption] });
      await campingOptionsResponse.promise;
    });

    await waitFor(() => {
      expect(screen.getByText('Camp Shifts: 1 required')).toBeInTheDocument();
      expect(screen.getByText('Manifest Assistant')).toBeInTheDocument();
      expect(screen.getByText('Additional Shifts: 1 required')).toBeInTheDocument();
      expect(screen.getByText('Teardown', { selector: 'h4' })).toBeInTheDocument();
    });

    expect(screen.queryByText('Unrelated Work')).not.toBeInTheDocument();
    expect(screen.queryByText('Unrelated Job')).not.toBeInTheDocument();
    expect(jobs.getAll).toHaveBeenCalledTimes(1);
  });
});
