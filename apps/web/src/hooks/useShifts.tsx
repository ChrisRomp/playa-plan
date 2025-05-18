import { useCallback, useEffect, useState } from 'react';
import { shifts, Shift } from '../lib/api';

interface UseShiftsResult {
  shifts: Shift[];
  loading: boolean;
  error: string | null;
  fetchShifts: (filters?: { jobId?: string; dayOfWeek?: string }) => Promise<void>;
  createShift: (data: Omit<Shift, 'id' | 'job'>) => Promise<Shift | null>;
  updateShift: (id: string, data: Partial<Omit<Shift, 'id' | 'job'>>) => Promise<Shift | null>;
  deleteShift: (id: string) => Promise<boolean>;
  getShiftRegistrations: (shiftId: string) => Promise<unknown[]>;
}

export function useShifts(): UseShiftsResult {
  const [shiftsList, setShiftsList] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShifts = useCallback(async (filters?: { jobId?: string; dayOfWeek?: string }) => {
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

  const createShift = useCallback(async (data: Omit<Shift, 'id' | 'job'>) => {
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

  const updateShift = useCallback(async (id: string, data: Partial<Omit<Shift, 'id' | 'job'>>) => {
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

  const getShiftRegistrations = useCallback(async (shiftId: string) => {
    setLoading(true);
    setError(null);
    try {
      const registrations = await shifts.getRegistrations(shiftId);
      return registrations;
    } catch {
      setError('Failed to fetch shift registrations');
      return [];
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
    getShiftRegistrations,
  };
} 