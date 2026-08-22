import { useState, useCallback, useRef } from 'react';
import { JobCategory, Job, api, jobCategories, jobs, shifts, Shift, CampingOption } from '../lib/api';

// Define types for registration data
export interface RegistrationFormData {
  campingOptions: string[];
  customFields: Record<string, unknown>;
  jobs: string[];  // Changed from shifts to jobs
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const jobsRequestId = useRef(0);

  // Fetch camping options
  const fetchCampingOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/camping-options');
      setCampingOptions(response.data);
    } catch (err) {
      setError('Failed to fetch camping options');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch job categories
  const fetchJobCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await jobCategories.getAll();
      setCategories(result);
    } catch (err) {
      setError('Failed to fetch job categories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch shifts
  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await shifts.getAll();
      setShiftsList(result);
    } catch (err) {
      setError('Failed to fetch shifts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch the complete role-filtered collection. Eligibility is derived by the page.
  const fetchJobs = useCallback(async () => {
    const requestId = ++jobsRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const allJobs = await jobs.getAll();

      if (requestId === jobsRequestId.current) {
        setJobsList(allJobs);
      }
    } catch (err) {
      if (requestId === jobsRequestId.current) {
        setError('Failed to fetch jobs');
        console.error(err);
      }
    } finally {
      if (requestId === jobsRequestId.current) {
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
    loading,
    error,
    fetchCampingOptions,
    fetchJobCategories,
    fetchShifts,
    fetchJobs,
    submitRegistration,
  };
}
