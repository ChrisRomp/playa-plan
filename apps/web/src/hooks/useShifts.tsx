import { useCallback, useEffect, useState } from 'react';
import { shifts, Shift } from '../lib/api';

// Define the type for shift input data
export type ShiftInput = Omit<Shift, 'id' | 'jobs'> & {
  name: string;
  description?: string;
  /**
   * Time string in HH:MM format (24-hour time)
   * Examples: "09:00", "14:30", "23:45"
   */
  startTime: string;
  /**
   * Time string in HH:MM format (24-hour time)
   * Examples: "09:00", "14:30", "23:45"
   */
  endTime: string;
  dayOfWeek: string;
  // campId field has been removed
};

interface UseShiftsResult {
  shifts: Shift[];
  loading: boolean;
  error: string | null;
  fetchShifts: (filters?: { dayOfWeek?: string }) => Promise<void>;
  createShift: (data: ShiftInput) => Promise<Shift | null>;
  updateShift: (id: string, data: Partial<ShiftInput>) => Promise<Shift | null>;
  deleteShift: (id: string) => Promise<boolean>;
}

export function useShifts(): UseShiftsResult {
  const [shiftsList, setShiftsList] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShifts = useCallback(async (filters?: { dayOfWeek?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await shifts.getAll(filters);
      setShiftsList(data);
    } catch {
      setError('Failed to fetch shifts');
    } finally {
      setLoading(false);
    }
  }, []);

  const createShift = useCallback(async (data: ShiftInput) => {
    setLoading(true);
    setError(null);
    try {
      const created = await shifts.create(data);
      setShiftsList((prev) => [...prev, created]);
      return created;
    } catch {
      setError('Failed to create shift');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateShift = useCallback(async (id: string, data: Partial<ShiftInput>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await shifts.update(id, data);
      setShiftsList((prev) => prev.map((shift) => (shift.id === id ? updated : shift)));
      return updated;
    } catch {
      setError('Failed to update shift');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteShift = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await shifts.delete(id);
      setShiftsList((prev) => prev.filter((shift) => shift.id !== id));
      return true;
    } catch {
      setError('Failed to delete shift');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  return {
    shifts: shiftsList,
    loading,
    error,
    fetchShifts,
    createShift,
    updateShift,
    deleteShift,
  };
} 