import { useState, useCallback } from 'react';
import { api } from '../lib/api';

export interface SubmitApplicationData {
  campingOptions: string[];
  customFields?: Record<string, unknown>;
}

export interface CompleteRegistrationData {
  jobs: string[];
  acceptedTerms: boolean;
  deferPayment?: boolean;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export function useApplicationSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitApplication = useCallback(async (data: SubmitApplicationData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/registrations/apply', data);
      return response.data;
    } catch (err: unknown) {
      const message = (err as ApiError)?.response?.data?.message
        || (err instanceof Error ? err.message : 'Failed to submit application');
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const completeRegistration = useCallback(async (data: CompleteRegistrationData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/registrations/complete', data);
      return response.data;
    } catch (err: unknown) {
      const message = (err as ApiError)?.response?.data?.message
        || (err instanceof Error ? err.message : 'Failed to complete registration');
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    submitApplication,
    completeRegistration,
    loading,
    error,
  };
}
