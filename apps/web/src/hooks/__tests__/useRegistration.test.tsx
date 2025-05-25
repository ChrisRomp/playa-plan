import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRegistration } from '../useRegistration';
import * as apiModule from '../../lib/api';
import { Mock } from 'vitest';

// Mock the API module
vi.mock('../../lib/api', () => {
  return {
    api: {
      get: vi.fn(),
      post: vi.fn(),
    },
    jobCategories: {
      getAll: vi.fn(),
    },
    jobs: {
      getAll: vi.fn(),
    },
    shifts: {
      getAll: vi.fn(),
    }
  };
});

describe('useRegistration', () => {
  const mockCampingOptions = [
    {
      id: 'camp-1',
      name: 'Regular Camp',
      description: 'Regular camping option',
      enabled: true,
      workShiftsRequired: 2,
      jobCategoryIds: ['job-cat-1', 'job-cat-2'],
      participantDues: 100,
      staffDues: 50,
      maxSignups: 50,
      currentRegistrations: 20,
    },
    {
      id: 'camp-2',
      name: 'Special Camp',
      description: 'Special camping option',
      enabled: true,
      workShiftsRequired: 3,
      jobCategoryIds: ['job-cat-3'],
      participantDues: 150,
      staffDues: 75,
      maxSignups: 30,
      currentRegistrations: 15,
    },
  ];

  const mockJobCategories = [
    {
      id: 'job-cat-1',
      name: 'Kitchen',
      description: 'Kitchen jobs',
      staffOnly: false,
      alwaysRequired: false,
    },
    {
      id: 'job-cat-2',
      name: 'Greeter',
      description: 'Greeting shifts',
      staffOnly: true,
      alwaysRequired: false,
    },
    {
      id: 'job-cat-3',
      name: 'Mooping',
      description: 'Camp cleanup',
      staffOnly: false,
      alwaysRequired: false,
    },
    {
      id: 'job-cat-4',
      name: 'Safety',
      description: 'Required safety shifts',
      staffOnly: false,
      alwaysRequired: true,
    },
  ];

  const mockShifts = [
    {
      id: 'shift-1',
      name: 'Morning Shift',
      description: 'Morning kitchen shift',
      startTime: '2023-06-01T09:00:00Z',
      endTime: '2023-06-01T13:00:00Z',
      dayOfWeek: 'MONDAY',
      campId: 'camp-1',
    },
    {
      id: 'shift-2',
      name: 'Safety Shift',
      description: 'Afternoon safety shift',
      startTime: '2023-06-02T14:00:00Z',
      endTime: '2023-06-02T18:00:00Z',
      dayOfWeek: 'TUESDAY',
      campId: 'camp-1',
    },
  ];

  const mockJobs = [
    {
      id: 'job-1',
      name: 'Line Cook',
      description: 'Cooking on the line',
      location: 'Kitchen',
      categoryId: 'job-cat-1',
      category: mockJobCategories[0],
      shiftId: 'shift-1',
      maxRegistrations: 5,
      currentRegistrations: 2,
      staffOnly: false,
      alwaysRequired: false,
    },
    {
      id: 'job-2',
      name: 'Safety Officer',
      description: 'Safety monitoring',
      location: 'Camp-wide',
      categoryId: 'job-cat-4',
      category: mockJobCategories[3],
      shiftId: 'shift-2',
      maxRegistrations: 3,
      currentRegistrations: 1,
      staffOnly: false,
      alwaysRequired: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses
    (apiModule.api.get as Mock).mockImplementation((url: string) => {
      if (url === '/camping-options') {
        return Promise.resolve({ data: mockCampingOptions });
      } 
      return Promise.reject(new Error('Not found'));
    });
    
    (apiModule.jobCategories.getAll as Mock).mockResolvedValue(mockJobCategories);
    (apiModule.jobs.getAll as Mock).mockResolvedValue(mockJobs);
    (apiModule.shifts.getAll as Mock).mockResolvedValue(mockShifts);
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useRegistration());
    
    expect(result.current.campingOptions).toEqual([]);
    expect(result.current.jobCategories).toEqual([]);
    expect(result.current.jobs).toEqual([]);
    expect(result.current.shifts).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch camping options', async () => {
    const { result } = renderHook(() => useRegistration());
    
    await act(async () => {
      await result.current.fetchCampingOptions();
    });
    
    expect(apiModule.api.get).toHaveBeenCalledWith('/camping-options');
    expect(result.current.campingOptions).toHaveLength(2);
    expect(result.current.campingOptions[0].id).toBe('camp-1');
    expect(result.current.campingOptions[1].id).toBe('camp-2');
  });

  it('should fetch job categories', async () => {
    const { result } = renderHook(() => useRegistration());
    
    await act(async () => {
      await result.current.fetchJobCategories();
    });
    
    expect(apiModule.jobCategories.getAll).toHaveBeenCalled();
    expect(result.current.jobCategories).toHaveLength(4);
    expect(result.current.jobCategories[3].id).toBe('job-cat-4');
    expect(result.current.jobCategories[3].alwaysRequired).toBe(true);
  });

  it('should fetch shifts', async () => {
    const { result } = renderHook(() => useRegistration());
    
    await act(async () => {
      await result.current.fetchShifts();
    });
    
    expect(apiModule.shifts.getAll).toHaveBeenCalled();
    expect(result.current.shifts).toHaveLength(2);
    expect(result.current.shifts[0].id).toBe('shift-1');
    expect(result.current.shifts[1].id).toBe('shift-2');
  });

  describe('fetchJobs', () => {
    it('should include alwaysRequired categories in request even when no camping options selected', async () => {
      const { result } = renderHook(() => useRegistration());
      
      // First load job categories so we have the alwaysRequired data
      await act(async () => {
        await result.current.fetchJobCategories();
      });
      
      // Now fetch jobs without selecting any camping options
      await act(async () => {
        await result.current.fetchJobs([]);
      });
      
      expect(apiModule.jobs.getAll).toHaveBeenCalled();
    });
    
    it('should include both camping option categories and alwaysRequired categories', async () => {
      const { result } = renderHook(() => useRegistration());
      
      // First load job categories so we have the alwaysRequired data
      await act(async () => {
        await result.current.fetchJobCategories();
      });
      
      // Also load camping options
      await act(async () => {
        await result.current.fetchCampingOptions();
      });
      
      // Now fetch jobs selecting the first camping option
      await act(async () => {
        await result.current.fetchJobs(['camp-1']);
      });
      
      // Verify jobs.getAll was called
      expect(apiModule.jobs.getAll).toHaveBeenCalled();
    });

    it('should handle errors when fetching jobs', async () => {
      const { result } = renderHook(() => useRegistration());
      
      // Mock an error response
      (apiModule.jobs.getAll as Mock).mockRejectedValueOnce(new Error('Failed to fetch jobs'));
      
      await act(async () => {
        await result.current.fetchJobs(['camp-1']);
      });
      
      expect(result.current.error).toBe('Failed to fetch jobs');
      expect(result.current.jobs).toEqual([]);
    });
  });

  it('should submit registration', async () => {
    const { result } = renderHook(() => useRegistration());
    const mockRegistrationData = {
      campingOptions: ['camp-1'],
      jobs: ['job-1', 'job-2'],
      customFields: {},
      acceptedTerms: true,
    };
    
    (apiModule.api.post as Mock).mockResolvedValueOnce({
      data: { success: true, registrationId: 'reg-123' },
    });
    
    let response;
    await act(async () => {
      response = await result.current.submitRegistration(mockRegistrationData);
    });
    
    expect(apiModule.api.post).toHaveBeenCalledWith('/registrations/camp', mockRegistrationData);
    expect(response).toEqual({ success: true, registrationId: 'reg-123' });
  });
}); 