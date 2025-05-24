import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCampRegistration } from '../useCampRegistration';
import * as apiModule from '../../lib/api';
import { Mock } from 'vitest';

// Mock the API module
vi.mock('../../lib/api', () => {
  return {
    registrations: {
      getMyCampRegistration: vi.fn(),
    }
  };
});

describe('useCampRegistration', () => {
  const mockCampRegistration = {
    campingOptions: [
      {
        id: 'camping-reg-1',
        userId: 'user-1',
        campingOptionId: 'camping-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        campingOption: {
          id: 'camping-1',
          name: 'Standard Camping',
          description: 'Basic camping option',
          enabled: true,
          workShiftsRequired: 2,
          participantDues: 200,
          staffDues: 150,
          maxSignups: 50,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          jobCategoryIds: ['cat-1', 'cat-2'],
          fields: [
            {
              id: 'field-1',
              displayName: 'Dietary Restrictions',
              description: 'Any dietary needs',
              dataType: 'STRING',
              required: false,
              maxLength: 200,
              minValue: null,
              maxValue: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              campingOptionId: 'camping-1'
            }
          ]
        }
      }
    ],
    customFieldValues: [
      {
        id: 'field-value-1',
        value: 'Vegetarian',
        fieldId: 'field-1',
        registrationId: 'camping-reg-1',
        field: {
          id: 'field-1',
          displayName: 'Dietary Restrictions',
          description: 'Any dietary needs',
          dataType: 'STRING',
          required: false,
          maxLength: 200,
          minValue: null,
          maxValue: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          campingOptionId: 'camping-1'
        }
      }
    ],
    jobRegistrations: [
      {
        id: 'job-reg-1',
        userId: 'user-1',
        jobId: 'job-1',
        status: 'COMPLETE' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        job: {
          id: 'job-1',
          name: 'Kitchen Helper',
          description: 'Help with meal prep',
          location: 'Kitchen',
          shift: {
            id: 'shift-1',
            name: 'Morning Kitchen',
            description: 'Morning prep work',
            startTime: '2024-01-01T08:00:00Z',
            endTime: '2024-01-01T12:00:00Z',
            dayOfWeek: 'MONDAY'
          }
        }
      }
    ],
    hasRegistration: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API response by default
    (apiModule.registrations.getMyCampRegistration as Mock).mockResolvedValue(mockCampRegistration);
  });

  it('should initialize with null camp registration and loading true', () => {
    const { result } = renderHook(() => useCampRegistration());
    
    expect(result.current.campRegistration).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should fetch camp registration on mount', async () => {
    const { result } = renderHook(() => useCampRegistration());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(apiModule.registrations.getMyCampRegistration).toHaveBeenCalled();
    expect(result.current.campRegistration).toEqual(mockCampRegistration);
    expect(result.current.error).toBeNull();
  });

  it('should handle error when fetching camp registration', async () => {
    // Mock an error response from the start
    (apiModule.registrations.getMyCampRegistration as Mock).mockRejectedValue(new Error('API error'));
    
    const { result } = renderHook(() => useCampRegistration());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.error).toBe('Failed to fetch camp registration');
    expect(result.current.campRegistration).toBeNull();
  });

  it('should refetch camp registration when refetch is called', async () => {
    const { result } = renderHook(() => useCampRegistration());
    
    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Clear the mock and set new data
    vi.clearAllMocks();
    const newRegistration = {
      ...mockCampRegistration,
      hasRegistration: false,
      campingOptions: [],
      jobRegistrations: []
    };
    (apiModule.registrations.getMyCampRegistration as Mock).mockResolvedValue(newRegistration);
    
    await act(async () => {
      await result.current.refetch();
    });
    
    expect(apiModule.registrations.getMyCampRegistration).toHaveBeenCalled();
    expect(result.current.campRegistration).toEqual(newRegistration);
    expect(result.current.error).toBeNull();
  });

  it('should handle camp registration with no registrations', async () => {
    const emptyRegistration = {
      campingOptions: [],
      customFieldValues: [],
      jobRegistrations: [],
      hasRegistration: false
    };
    
    (apiModule.registrations.getMyCampRegistration as Mock).mockResolvedValue(emptyRegistration);
    
    const { result } = renderHook(() => useCampRegistration());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.campRegistration).toEqual(emptyRegistration);
    expect(result.current.campRegistration?.hasRegistration).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle refetch error correctly', async () => {
    const { result } = renderHook(() => useCampRegistration());
    
    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Clear the mock and set up error for refetch
    vi.clearAllMocks();
    (apiModule.registrations.getMyCampRegistration as Mock).mockRejectedValue(new Error('Refetch error'));
    
    await act(async () => {
      await result.current.refetch();
    });
    
    expect(result.current.error).toBe('Failed to fetch camp registration');
    expect(result.current.loading).toBe(false);
  });
}) 