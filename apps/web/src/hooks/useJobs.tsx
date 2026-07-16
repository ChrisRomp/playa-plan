import { useCallback, useEffect, useRef, useState } from 'react';
import { jobs, Job } from '../lib/api';

// Type for job inputs without derived/readonly fields
export type JobInput = Omit<Job, 'id' | 'category' | 'shift' | 'staffOnly' | 'alwaysRequired'> & {
  categoryId: string;
  shiftId: string;
  maxRegistrations: number;
};

interface UseJobsResult {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  fetchJobs: (includeInactive?: boolean) => Promise<void>;
  createJob: (data: JobInput) => Promise<Job | null>;
  updateJob: (id: string, data: Partial<JobInput>) => Promise<Job | null>;
  deleteJob: (id: string) => Promise<boolean>;
}

export function useJobs(includeInactive = false): UseJobsResult {
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const includeInactiveRef = useRef(includeInactive);
  includeInactiveRef.current = includeInactive;

  const fetchJobs = useCallback(async (shouldIncludeInactive = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobs.getAll(shouldIncludeInactive);
      setJobsList(data);
    } catch {
      setError('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  const createJob = useCallback(async (data: JobInput) => {
    setLoading(true);
    setError(null);
    try {
      const created = await jobs.create(data);
      if (created.active || includeInactiveRef.current) {
        setJobsList((prev) => [...prev, created]);
      }
      return created;
    } catch {
      setError('Failed to create job');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateJob = useCallback(async (id: string, data: Partial<JobInput>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await jobs.update(id, data);
      setJobsList((prev) => {
        if (!updated.active && !includeInactiveRef.current) {
          return prev.filter((job) => job.id !== id);
        }
        return prev.map((job) => (job.id === id ? updated : job));
      });
      return updated;
    } catch {
      setError('Failed to update job');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteJob = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await jobs.delete(id);
      setJobsList((prev) => prev.filter((job) => job.id !== id));
      return true;
    } catch (caughtError) {
      throw caughtError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(includeInactive);
  }, [fetchJobs, includeInactive]);

  return {
    jobs: jobsList,
    loading,
    error,
    fetchJobs,
    createJob,
    updateJob,
    deleteJob,
  };
} 