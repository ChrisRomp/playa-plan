import { useState, useEffect, useCallback } from 'react';
import { registrations, CampingOptionRegistration, CampingOptionField } from '../lib/api';

interface CampRegistrationData {
  campingOptions: CampingOptionRegistration[];
  customFieldValues: Array<{
    id: string;
    value: string;
    fieldId: string;
    registrationId: string;
    field: CampingOptionField;
  }>;
  jobRegistrations: Array<{
    id: string;
    userId: string;
    jobId: string;
    status: 'PENDING' | 'COMPLETE' | 'WAITLISTED' | 'CANCELLED';
    createdAt: string;
    updatedAt: string;
    job?: {
      id: string;
      name: string;
      description: string;
      location: string;
      shift?: {
        id: string;
        name: string;
        description: string;
        startTime: string;
        endTime: string;
        dayOfWeek: string;
      };
    };
  }>;
  hasRegistration: boolean;
}

interface UseCampRegistrationResult {
  campRegistration: CampRegistrationData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing the user's complete camp registration
 * @returns An object containing camp registration data, loading state, error state, and refetch function
 */
export function useCampRegistration(): UseCampRegistrationResult {
  const [campRegistration, setCampRegistration] = useState<CampRegistrationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampRegistration = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await registrations.getMyCampRegistration();
      setCampRegistration(data);
    } catch (err) {
      setError('Failed to fetch camp registration');
      console.error('Error fetching camp registration:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampRegistration();
  }, [fetchCampRegistration]);

  return {
    campRegistration,
    loading,
    error,
    refetch: fetchCampRegistration,
  };
} 