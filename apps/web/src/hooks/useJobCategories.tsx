import { useCallback, useEffect, useState, useRef } from 'react';
import { jobCategories, JobCategory } from '../lib/api';

interface UseJobCategoriesResult {
  categories: JobCategory[];
  loading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
  createCategory: (data: Omit<JobCategory, 'id'>) => Promise<JobCategory | null>;
  updateCategory: (id: string, data: Partial<Omit<JobCategory, 'id'>>) => Promise<JobCategory | null>;
  deleteCategory: (id: string) => Promise<boolean>;
}

export function useJobCategories(): UseJobCategoriesResult {
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchCategories = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const data = await jobCategories.getAll();
      if (mountedRef.current) {
        setCategories(data);
      }
    } catch {
      if (mountedRef.current) {
        setError('Failed to fetch job categories');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const createCategory = useCallback(async (data: Omit<JobCategory, 'id'>) => {
    if (!mountedRef.current) return null;
    setLoading(true);
    setError(null);
    try {
      const created = await jobCategories.create(data);
      if (mountedRef.current) {
        setCategories((prev) => [...prev, created]);
      }
      return created;
    } catch {
      if (mountedRef.current) {
        setError('Failed to create job category');
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const updateCategory = useCallback(async (id: string, data: Partial<Omit<JobCategory, 'id'>>) => {
    if (!mountedRef.current) return null;
    setLoading(true);
    setError(null);
    try {
      const updated = await jobCategories.update(id, data);
      if (mountedRef.current) {
        setCategories((prev) => prev.map((cat) => (cat.id === id ? updated : cat)));
      }
      return updated;
    } catch {
      if (mountedRef.current) {
        setError('Failed to update job category');
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    if (!mountedRef.current) return false;
    setLoading(true);
    setError(null);
    try {
      await jobCategories.delete(id);
      if (mountedRef.current) {
        setCategories((prev) => prev.filter((cat) => cat.id !== id));
      }
      return true;
    } catch {
      if (mountedRef.current) {
        setError('Failed to delete job category');
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
} 