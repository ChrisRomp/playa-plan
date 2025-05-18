import { useState } from 'react';
import { z } from 'zod';
import { JobCategory, api } from '../lib/api';

// Define types for registration data
export interface RegistrationFormData {
  campingOptions: string[];
  customFields: Record<string, unknown>;
  shifts: string[];
  acceptedTerms: boolean;
}

// Schema for camping options
export const CampingOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  shiftsRequired: z.number(),
  jobCategories: z.array(z.string()).optional(),
  participantDues: z.number(),
  staffDues: z.number(),
  maxSignups: z.number(),
  currentSignups: z.number().optional(),
});

export type CampingOption = z.infer<typeof CampingOptionSchema>;

// Schema for shifts
export const ShiftSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  jobCategoryId: z.string(),
  jobName: z.string().optional(),
  categoryName: z.string().optional(),
  day: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  maxParticipants: z.number(),
  currentParticipants: z.number().optional(),
});

export type Shift = z.infer<typeof ShiftSchema>;

export function useRegistration() {
  const [campingOptions, setCampingOptions] = useState<CampingOption[]>([]);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
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
      const response = await api.get('/job-categories');
      setJobCategories(response.data);
    } catch (err) {
      setError('Failed to fetch job categories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available shifts
  const fetchShifts = async (campingOptionIds: string[] = []) => {
    setLoading(true);
    setError(null);
    try {
      // Get always required categories
      const alwaysRequiredCategories = jobCategories
        .filter(cat => cat.alwaysRequired)
        .map(cat => cat.id);
      
      // Build query to fetch shifts for selected camping options
      // and always required categories
      const params = new URLSearchParams();
      
      // Add camping option IDs if provided
      campingOptionIds.forEach(id => {
        params.append('campingOptionIds', id);
      });
      
      // Add always required categories
      alwaysRequiredCategories.forEach(id => {
        params.append('jobCategoryIds', id);
      });
      
      // Find categories associated with the selected camping options
      const selectedCampingOptions = campingOptions.filter(
        option => campingOptionIds.includes(option.id)
      );
      
      // Add job categories from selected camping options
      selectedCampingOptions.forEach(option => {
        if (option.jobCategories) {
          option.jobCategories.forEach(catId => {
            params.append('jobCategoryIds', catId);
          });
        }
      });
      
      const queryString = params.toString();
      const response = await api.get(`/shifts?${queryString}`);
      const data = Array.isArray(response.data) 
        ? response.data.map((shift: unknown) => ShiftSchema.parse(shift))
        : [];
      setShifts(data);
    } catch (err) {
      setError('Failed to fetch shifts');
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
    jobCategories,
    shifts,
    loading,
    error,
    fetchCampingOptions,
    fetchJobCategories,
    fetchShifts,
    submitRegistration,
  };
}
