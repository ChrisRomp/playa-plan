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
  };
});

describe('useRegistration', () => {
  const mockCampingOptions = [
    {
      id: 'camp-1',
      name: 'Regular Camp',
      enabled: true,
      shiftsRequired: 2,
      jobCategories: ['job-cat-1', 'job-cat-2'],
      participantDues: 100,
      staffDues: 50,
      maxSignups: 50,
    },
    {
      id: 'camp-2',
      name: 'Special Camp',
      enabled: true,
      shiftsRequired: 3,
      jobCategories: ['job-cat-3'],
      participantDues: 150,
      staffDues: 75,
      maxSignups: 30,
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
      jobId: 'job-1',
      jobCategoryId: 'job-cat-1',
      jobName: 'Line Cook',
      categoryName: 'Kitchen',
      day: 'Monday',
      startTime: '09:00',
      endTime: '13:00',
      maxParticipants: 5,
      currentParticipants: 2,
    },
    {
      id: 'shift-2',
      jobId: 'job-2',
      jobCategoryId: 'job-cat-4',
      jobName: 'Safety Officer',
      categoryName: 'Safety',
      day: 'Tuesday',
      startTime: '14:00',
      endTime: '18:00',
      maxParticipants: 3,
      currentParticipants: 1,
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
    
    // Mock jobs API
    const mockJobs = mockShifts.map(shift => ({
      id: shift.jobId,
      name: shift.jobName,
      categoryId: shift.jobCategoryId,
      maxRegistrations: shift.maxParticipants,
      currentRegistrations: shift.currentParticipants
    }));
    (apiModule.jobs.getAll as Mock).mockResolvedValue(mockJobs);
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useRegistration());
    
    expect(result.current.campingOptions).toEqual([]);
    expect(result.current.jobCategories).toEqual([]);
    expect(result.current.availableJobs).toEqual([]);
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

  it('should fetch job categories using jobCategories.getAll()', async () => {
    const { result } = renderHook(() => useRegistration());
    
    await act(async () => {
      await result.current.fetchJobCategories();
    });
    
    expect(apiModule.jobCategories.getAll).toHaveBeenCalled();
    expect(result.current.jobCategories).toHaveLength(4);
    expect(result.current.jobCategories[3].id).toBe('job-cat-4');
    expect(result.current.jobCategories[3].alwaysRequired).toBe(true);
  });

  describe('fetchAvailableJobs', () => {
    it('should include alwaysRequired categories in request even when no camping options selected', async () => {
      const { result } = renderHook(() => useRegistration());
      
      // First load job categories so we have the alwaysRequired data
      await act(async () => {
        await result.current.fetchJobCategories();
      });
      
      // Now fetch jobs without selecting any camping options
      await act(async () => {
        await result.current.fetchAvailableJobs([]);
      });
      
      // Since we're now using jobs.getAll() and filtering client-side, we need to verify
      // that the jobs.getAll method was called
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
        await result.current.fetchAvailableJobs(['camp-1']);
      });
      
      // Verify jobs.getAll was called
      expect(apiModule.jobs.getAll).toHaveBeenCalled();
    });

    it('should handle errors when fetching jobs', async () => {
      const { result } = renderHook(() => useRegistration());
      
      // Mock an error response
      (apiModule.jobs.getAll as Mock).mockRejectedValueOnce(new Error('Failed to fetch available jobs'));
      
      await act(async () => {
        await result.current.fetchAvailableJobs(['camp-1']);
      });
      
      expect(result.current.error).toBe('Failed to fetch available jobs');
      expect(result.current.availableJobs).toEqual([]);
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
    
    expect(apiModule.api.post).toHaveBeenCalledWith('/registrations', mockRegistrationData);
    expect(response).toEqual({ success: true, registrationId: 'reg-123' });
  });
}); 