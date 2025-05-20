import { useState } from 'react';
import { z } from 'zod';
import { JobCategory, Job, api, jobCategories, jobs, shifts, Shift } from '../lib/api';

// Define types for registration data
export interface RegistrationFormData {
  campingOptions: string[];
  customFields: Record<string, unknown>;
  jobs: string[];  // Changed from shifts to jobs
  acceptedTerms: boolean;
}

// Schema for camping options
export const CampingOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  shiftsRequired: z.number(),
  jobCategories: z.array(z.string()).optional(),
  participantDues: z.number(),
  staffDues: z.number(),
  maxSignups: z.number(),
  currentSignups: z.number().optional(),
});

export type CampingOption = z.infer<typeof CampingOptionSchema>;

// Using JobSchema and ShiftSchema from api.ts instead of redefining them here

export function useRegistration() {
  const [campingOptions, setCampingOptions] = useState<CampingOption[]>([]);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [shiftsList, setShiftsList] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch camping options
  const fetchCampingOptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/camping-options');
      const data = response.data.map((option: unknown) => 
        CampingOptionSchema.parse(option)
      );
      setCampingOptions(data);
    } catch (err) {
      setError('Failed to fetch camping options');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch job categories
  const fetchJobCategories = async () => {
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
  };

  // Fetch shifts
  const fetchShifts = async () => {
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
  };

  // Fetch jobs 
  const fetchJobs = async (campingOptionIds: string[] = []) => {
    setLoading(true);
    setError(null);
    try {
      // Get always required categories
      const alwaysRequiredCategories = categories
        .filter(cat => cat.alwaysRequired)
        .map(cat => cat.id);
      
      // Build query to fetch jobs for selected camping options
      // and always required categories
      const params = new URLSearchParams();
      
      // Add always required categories
      alwaysRequiredCategories.forEach(id => {
        params.append('categoryIds', id);
      });
      
      // Find categories associated with the selected camping options
      const selectedCampingOptions = campingOptions.filter(
        option => campingOptionIds.includes(option.id)
      );
      
      // Add job categories from selected camping options
      selectedCampingOptions.forEach(option => {
        if (option.jobCategories) {
          option.jobCategories.forEach(catId => {
            params.append('categoryIds', catId);
          });
        }
      });
      
      // Fetch all jobs and filter client-side based on required parameters
      // This is a temporary solution until we implement proper filtering on the API
      const allJobs = await jobs.getAll();
      
      // Filter jobs based on the categories we're interested in
      const categoryIds = Array.from(params.getAll('categoryIds'));
      const filteredJobs = categoryIds.length > 0 
        ? allJobs.filter(job => categoryIds.includes(job.categoryId))
        : allJobs;
        
      setJobsList(filteredJobs);
    } catch (err) {
      setError('Failed to fetch jobs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Submit registration
  const submitRegistration = async (formData: RegistrationFormData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/registrations', formData);
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
