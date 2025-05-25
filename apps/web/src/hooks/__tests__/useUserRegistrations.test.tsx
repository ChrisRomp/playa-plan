import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserRegistrations } from '../useUserRegistrations';
import * as apiModule from '../../lib/api';
import { Mock } from 'vitest';

// Mock the API module
vi.mock('../../lib/api', () => {
  return {
    registrations: {
      getMyRegistrations: vi.fn(),
    }
  };
});

describe('useUserRegistrations', () => {
  const mockRegistrations = [
    {
      id: 'reg-1',
      userId: 'user-1',
      jobId: 'job-1',
      status: 'COMPLETE',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      job: {
        id: 'job-1',
        name: 'Line Cook',
        description: 'Cooking on the line',
        location: 'Kitchen',
        categoryId: 'job-cat-1',
        shiftId: 'shift-1',
        maxRegistrations: 5,
        shift: {
          id: 'shift-1',
          name: 'Morning Kitchen Shift',
          description: 'Morning cooking shift',
          startTime: '2024-01-01T09:00:00Z',
          endTime: '2024-01-01T13:00:00Z',
          dayOfWeek: 'MONDAY'
        }
      }
    },
    {
      id: 'reg-2',
      userId: 'user-1',
      jobId: 'job-2',
      status: 'PENDING',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      job: {
        id: 'job-2',
        name: 'Safety Officer',
        description: 'Safety monitoring',
        location: 'Camp-wide',
        categoryId: 'job-cat-2',
        shiftId: 'shift-2',
        maxRegistrations: 3,
        shift: {
          id: 'shift-2',
          name: 'Afternoon Safety Shift',
          description: 'Afternoon safety monitoring',
          startTime: '2024-01-01T14:00:00Z',
          endTime: '2024-01-01T18:00:00Z',
          dayOfWeek: 'TUESDAY'
        }
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API response by default
    (apiModule.registrations.getMyRegistrations as Mock).mockResolvedValue(mockRegistrations);
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useUserRegistrations());
    
    expect(result.current.registrations).toEqual([]);
    expect(result.current.loading).toBe(true); // Should start loading
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should fetch registrations on mount', async () => {
    const { result } = renderHook(() => useUserRegistrations());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(apiModule.registrations.getMyRegistrations).toHaveBeenCalled();
    expect(result.current.registrations).toHaveLength(2);
    expect(result.current.registrations[0].id).toBe('reg-1');
    expect(result.current.registrations[1].id).toBe('reg-2');
    expect(result.current.error).toBeNull();
  });

  it('should handle error when fetching registrations', async () => {
    // Mock an error response from the start
    (apiModule.registrations.getMyRegistrations as Mock).mockRejectedValue(new Error('API error'));
    
    const { result } = renderHook(() => useUserRegistrations());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.error).toBe('Failed to fetch registrations');
    expect(result.current.registrations).toEqual([]);
  });

  it('should refetch registrations when refetch is called', async () => {
    const { result } = renderHook(() => useUserRegistrations());
    
    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Clear the mock and set new data
    vi.clearAllMocks();
    const newRegistrations = [mockRegistrations[0]]; // Only one registration
    (apiModule.registrations.getMyRegistrations as Mock).mockResolvedValue(newRegistrations);
    
    await act(async () => {
      await result.current.refetch();
    });
    
    expect(apiModule.registrations.getMyRegistrations).toHaveBeenCalled();
    expect(result.current.registrations).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('should update loading state correctly during refetch', async () => {
    const { result } = renderHook(() => useUserRegistrations());
    
    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Clear the mock and set new data
    vi.clearAllMocks();
    const newRegistrations = [mockRegistrations[0]]; // Only one registration
    (apiModule.registrations.getMyRegistrations as Mock).mockResolvedValue(newRegistrations);
    
    // Start refetch
    await act(async () => {
      await result.current.refetch();
    });
    
    expect(result.current.loading).toBe(false);
    expect(result.current.registrations).toHaveLength(1);
  });
}); 