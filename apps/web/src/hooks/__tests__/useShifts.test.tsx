import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useShifts, ShiftInput } from '../useShifts';
import * as apiModule from '../../lib/api';
import { Mock } from 'vitest';

// Mock the API module
vi.mock('../../lib/api', () => {
  return {
    shifts: {
      getAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

describe('useShifts', () => {
  const mockShifts = [
    {
      id: '1',
      name: 'Morning Shift',
      description: 'Morning kitchen duty',
      startTime: '2023-06-01T09:00:00Z',
      endTime: '2023-06-01T13:00:00Z',
      dayOfWeek: 'MONDAY',
      campId: 'camp-1',
    },
    {
      id: '2',
      name: 'Afternoon Shift',
      description: 'Afternoon kitchen duty',
      startTime: '2023-06-01T14:00:00Z',
      endTime: '2023-06-01T18:00:00Z',
      dayOfWeek: 'MONDAY',
      campId: 'camp-1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    (apiModule.shifts.getAll as Mock).mockResolvedValue(mockShifts);
    (apiModule.shifts.create as Mock).mockImplementation((data: ShiftInput) => 
      Promise.resolve({ id: '3', ...data })
    );
    (apiModule.shifts.update as Mock).mockImplementation((id: string, data: Partial<ShiftInput>) => 
      Promise.resolve({ id, ...data })
    );
    (apiModule.shifts.delete as Mock).mockResolvedValue(undefined);
  });

  it('should fetch shifts on mount', async () => {
    const { result } = renderHook(() => useShifts());
    
    // Wait for the useEffect to run
    await vi.waitFor(() => {
      expect(result.current.shifts).toHaveLength(2);
    });
    
    expect(apiModule.shifts.getAll).toHaveBeenCalled();
    expect(result.current.shifts[0].id).toBe('1');
    expect(result.current.shifts[1].id).toBe('2');
  });

  it('should create a shift', async () => {
    const { result } = renderHook(() => useShifts());
    
    const newShift = {
      name: 'New Shift',
      description: 'New shift description',
      startTime: '2023-06-02T09:00:00Z',
      endTime: '2023-06-02T13:00:00Z',
      dayOfWeek: 'TUESDAY',
      campId: 'camp-1',
    };
    
    let createdShift;
    await act(async () => {
      createdShift = await result.current.createShift(newShift);
    });
    
    expect(apiModule.shifts.create).toHaveBeenCalledWith(newShift);
    expect(createdShift).toEqual({ id: '3', ...newShift });
    // Should update the local state
    expect(result.current.shifts).toContainEqual({ id: '3', ...newShift });
  });

  it('should update a shift', async () => {
    const { result } = renderHook(() => useShifts());
    
    // Ensure shifts are loaded first
    await vi.waitFor(() => {
      expect(result.current.shifts).toHaveLength(2);
    });
    
    const updatedData = {
      name: 'Updated Shift',
      description: 'Updated description',
    };
    
    let updatedShift;
    await act(async () => {
      updatedShift = await result.current.updateShift('1', updatedData);
    });
    
    expect(apiModule.shifts.update).toHaveBeenCalledWith('1', updatedData);
    expect(updatedShift).toEqual({ id: '1', ...updatedData });
    
    // Check that the state was updated
    const updatedShiftInState = result.current.shifts.find(s => s.id === '1');
    expect(updatedShiftInState).toBeDefined();
    expect(updatedShiftInState?.name).toBe('Updated Shift');
  });

  it('should delete a shift', async () => {
    const { result } = renderHook(() => useShifts());
    
    // Ensure shifts are loaded first
    await vi.waitFor(() => {
      expect(result.current.shifts).toHaveLength(2);
    });
    
    await act(async () => {
      await result.current.deleteShift('1');
    });
    
    expect(apiModule.shifts.delete).toHaveBeenCalledWith('1');
    
    // Check that the shift was removed from state
    expect(result.current.shifts).toHaveLength(1);
    expect(result.current.shifts.find(s => s.id === '1')).toBeUndefined();
  });

  it('should fetch shifts with filters', async () => {
    const { result } = renderHook(() => useShifts());
    
    await act(async () => {
      await result.current.fetchShifts({ dayOfWeek: 'MONDAY' });
    });
    
    expect(apiModule.shifts.getAll).toHaveBeenCalledWith({ dayOfWeek: 'MONDAY' });
  });

  it('should handle errors when fetching shifts', async () => {
    (apiModule.shifts.getAll as Mock).mockRejectedValueOnce(new Error('Failed to fetch shifts'));
    
    const { result } = renderHook(() => useShifts());
    
    // Wait for the component to finish rendering
    await vi.waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    
    expect(result.current.error).toBe('Failed to fetch shifts');
    expect(result.current.shifts).toEqual([]);
  });
}); 