import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useShifts } from '../useShifts';
import { shifts } from '../../lib/api';

// Mock the API
vi.mock('../../lib/api', () => ({
  shifts: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getRegistrations: vi.fn(),
  },
}));

describe('useShifts', () => {
  const mockShifts = [
    { 
      id: '1', 
      jobId: 'job1',
      startTime: '2023-06-01T09:00:00.000Z',
      endTime: '2023-06-01T17:00:00.000Z',
      maxParticipants: 5,
      dayOfWeek: 'MONDAY',
      name: 'Morning Shift',
      description: 'Morning shift description',
      location: 'Main Area',
    },
    { 
      id: '2', 
      jobId: 'job2',
      startTime: '2023-06-02T13:00:00.000Z',
      endTime: '2023-06-02T21:00:00.000Z',
      maxParticipants: 3,
      dayOfWeek: 'TUESDAY',
      name: 'Afternoon Shift',
      description: 'Afternoon shift description',
      location: 'Kitchen',
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    (shifts.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockShifts);
  });

  it('should fetch shifts on mount', async () => {
    const { result } = renderHook(() => useShifts());

    expect(result.current.loading).toBe(true);
    expect(shifts.getAll).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shifts).toEqual(mockShifts);
    expect(result.current.error).toBeNull();
  });

  it('should create a shift', async () => {
    const newShift = {
      jobId: 'job3',
      startTime: '2023-06-03T09:00:00.000Z',
      endTime: '2023-06-03T17:00:00.000Z',
      maxParticipants: 4,
      dayOfWeek: 'WEDNESDAY',
      name: 'New Shift',
      description: 'New shift description',
      location: 'Garden',
    };

    const createdShift = { ...newShift, id: '3' };
    (shifts.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdShift);

    const { result } = renderHook(() => useShifts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const created = await result.current.createShift(newShift);
      expect(created).toEqual(createdShift);
    });

    expect(shifts.create).toHaveBeenCalledWith(newShift);
    expect(result.current.shifts).toEqual([...mockShifts, createdShift]);
  });

  it('should update a shift', async () => {
    const updateData = {
      name: 'Updated Shift',
      description: 'Updated Description',
      maxParticipants: 8,
    };

    const updatedShift = { ...mockShifts[0], ...updateData };
    (shifts.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedShift);

    const { result } = renderHook(() => useShifts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const updated = await result.current.updateShift('1', updateData);
      expect(updated).toEqual(updatedShift);
    });

    expect(shifts.update).toHaveBeenCalledWith('1', updateData);
    expect(result.current.shifts[0]).toEqual(updatedShift);
  });

  it('should delete a shift', async () => {
    (shifts.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockShifts[0]);

    const { result } = renderHook(() => useShifts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const deleted = await result.current.deleteShift('1');
      expect(deleted).toBe(true);
    });

    expect(shifts.delete).toHaveBeenCalledWith('1');
    expect(result.current.shifts).toEqual([mockShifts[1]]);
  });

  it('should fetch shifts with filters', async () => {
    const filters = { jobId: 'job1', dayOfWeek: 'MONDAY' };
    const filteredShifts = [mockShifts[0]];
    
    (shifts.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(filteredShifts);
    
    const { result } = renderHook(() => useShifts());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    await act(async () => {
      await result.current.fetchShifts(filters);
    });
    
    expect(shifts.getAll).toHaveBeenCalledWith(filters);
    expect(result.current.shifts).toEqual(filteredShifts);
  });

  it('should get shift registrations', async () => {
    const mockRegistrations = [
      { id: 'reg1', userId: 'user1', shiftId: '1', status: 'CONFIRMED' },
      { id: 'reg2', userId: 'user2', shiftId: '1', status: 'PENDING' },
    ];
    
    (shifts.getRegistrations as ReturnType<typeof vi.fn>).mockResolvedValue(mockRegistrations);
    
    const { result } = renderHook(() => useShifts());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    let registrations;
    await act(async () => {
      registrations = await result.current.getShiftRegistrations('1');
    });
    
    expect(shifts.getRegistrations).toHaveBeenCalledWith('1');
    expect(registrations).toEqual(mockRegistrations);
  });

  it('should handle errors when fetching shifts', async () => {
    (shifts.getAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to fetch'));
    
    const { result } = renderHook(() => useShifts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shifts).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch shifts');
  });
}); 