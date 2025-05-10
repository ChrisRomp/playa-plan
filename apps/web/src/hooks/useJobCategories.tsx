import { useCallback, useEffect, useState } from 'react';
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

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobCategories.getAll();
      setCategories(data);
    } catch {
      setError('Failed to fetch job categories');
    } finally {
      setLoading(false);
    }
  }, []);

  const createCategory = useCallback(async (data: Omit<JobCategory, 'id'>) => {
    setLoading(true);
    setError(null);
    try {
      const created = await jobCategories.create(data);
      setCategories((prev) => [...prev, created]);
      return created;
    } catch {
      setError('Failed to create job category');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCategory = useCallback(async (id: string, data: Partial<Omit<JobCategory, 'id'>>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await jobCategories.update(id, data);
      setCategories((prev) => prev.map((cat) => (cat.id === id ? updated : cat)));
      return updated;
    } catch {
      setError('Failed to update job category');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await jobCategories.delete(id);
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
      return true;
    } catch (err) {
      setError('Failed to delete job category');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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