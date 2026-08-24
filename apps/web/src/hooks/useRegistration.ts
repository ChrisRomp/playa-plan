import { useState, useCallback, useRef } from 'react';
import { JobCategory, Job, api, jobCategories, jobs, shifts, Shift, CampingOption } from '../lib/api';

// Define types for registration data
export interface RegistrationFormData {
  campingOptions: string[];
  customFields: Record<string, unknown>;
  jobs: string[];  // Changed from shifts to jobs
  extraShiftsConfirmed: boolean;
  acceptedTerms: boolean;
  /**
   * When true, the participant is opting to defer dues payment. The server
   * enforces eligibility (`coreConfig.allowDeferredDuesPayment` AND
   * `user.allowDeferredDuesPayment`) and rejects with 403 otherwise; the
   * client should only set this when the "Pay Dues Later" button is shown.
   */
  deferPayment?: boolean;
}

// Using JobSchema and ShiftSchema from api.ts instead of redefining them here

export function useRegistration() {
  const [campingOptions, setCampingOptions] = useState<CampingOption[]>([]);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [shiftsList, setShiftsList] = useState<Shift[]>([]);
  const [loadedResources, setLoadedResources] = useState({
    campingOptions: false,
    jobCategories: false,
    jobs: false,
    shifts: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIds = useRef({
    campingOptions: 0,
    jobCategories: 0,
    jobs: 0,
    shifts: 0,
  });

  // Fetch camping options
  const fetchCampingOptions = useCallback(async () => {
    const requestId = ++requestIds.current.campingOptions;
    setLoadedResources(current => ({ ...current, campingOptions: false }));
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/camping-options');
      if (requestId === requestIds.current.campingOptions) {
        setCampingOptions(response.data);
      }
    } catch (err) {
      if (requestId === requestIds.current.campingOptions) {
        setError('Failed to fetch camping options');
        console.error(err);
      }
    } finally {
      if (requestId === requestIds.current.campingOptions) {
        setLoadedResources(current => ({ ...current, campingOptions: true }));
        setLoading(false);
      }
    }
  }, []);

  // Fetch job categories
  const fetchJobCategories = useCallback(async () => {
    const requestId = ++requestIds.current.jobCategories;
    setLoadedResources(current => ({ ...current, jobCategories: false }));
    setLoading(true);
    setError(null);
    try {
      const result = await jobCategories.getAll();
      if (requestId === requestIds.current.jobCategories) {
        setCategories(result);
      }
    } catch (err) {
      if (requestId === requestIds.current.jobCategories) {
        setError('Failed to fetch job categories');
        console.error(err);
      }
    } finally {
      if (requestId === requestIds.current.jobCategories) {
        setLoadedResources(current => ({ ...current, jobCategories: true }));
        setLoading(false);
      }
    }
  }, []);

  // Fetch shifts
  const fetchShifts = useCallback(async () => {
    const requestId = ++requestIds.current.shifts;
    setLoadedResources(current => ({ ...current, shifts: false }));
    setLoading(true);
    setError(null);
    try {
      const result = await shifts.getAll();
      if (requestId === requestIds.current.shifts) {
        setShiftsList(result);
      }
    } catch (err) {
      if (requestId === requestIds.current.shifts) {
        setError('Failed to fetch shifts');
        console.error(err);
      }
    } finally {
      if (requestId === requestIds.current.shifts) {
        setLoadedResources(current => ({ ...current, shifts: true }));
        setLoading(false);
      }
    }
  }, []);

  // Fetch the complete role-filtered collection. Eligibility is derived by the page.
  const fetchJobs = useCallback(async () => {
    const requestId = ++requestIds.current.jobs;
    setLoadedResources(current => ({ ...current, jobs: false }));
    setLoading(true);
    setError(null);
    try {
      const allJobs = await jobs.getAll();

      if (requestId === requestIds.current.jobs) {
        setJobsList(allJobs);
      }
    } catch (err) {
      if (requestId === requestIds.current.jobs) {
        setError('Failed to fetch jobs');
        console.error(err);
      }
    } finally {
      if (requestId === requestIds.current.jobs) {
        setLoadedResources(current => ({ ...current, jobs: true }));
        setLoading(false);
      }
    }
  }, []);

  // Submit registration
  const submitRegistration = async (formData: RegistrationFormData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/registrations/camp', formData);
      return response.data;
    } catch (err) {
      setError('Failed to submit registration');
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    campingOptions,
    jobCategories: categories,
    jobs: jobsList,
    shifts: shiftsList,
    initialDataLoaded: Object.values(loadedResources).every(Boolean),
    loading,
    error,
    fetchCampingOptions,
    fetchJobCategories,
    fetchShifts,
    fetchJobs,
    submitRegistration,
  };
}
