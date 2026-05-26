import { useState, useEffect, useCallback } from 'react';
import { registrations } from '../lib/api';
import { useAuth } from '../store/authUtils';
import { useConfig } from './useConfig';

export interface MyRegistration {
  id: string;
  status: string;
  year: number;
  paymentDeferred?: boolean;
  reviewedAt?: string | null;
  decisionMessage?: string | null;
  createdAt: string;
}

interface UseMyRegistrationResult {
  registration: MyRegistration | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMyRegistration(): UseMyRegistrationResult {
  const { isAuthenticated } = useAuth();
  const { config } = useConfig();
  const [registration, setRegistration] = useState<MyRegistration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistration = useCallback(async () => {
    if (!isAuthenticated || !config?.currentYear) {
      setRegistration(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await registrations.getMyRegistrationForYear(config.currentYear);

      if (!response) {
        setRegistration(null);
        return;
      }

      setRegistration({
        id: response.id,
        status: response.status,
        year: response.year,
        paymentDeferred: response.paymentDeferred,
        reviewedAt: response.reviewedAt ?? null,
        decisionMessage: response.decisionMessage ?? null,
        createdAt: response.createdAt,
      });
    } catch (err) {
      setRegistration(null);
      setError('Failed to fetch registration');
      console.error('Error fetching current registration:', err);
    } finally {
      setLoading(false);
    }
  }, [config?.currentYear, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setRegistration(null);
      setError(null);
      return;
    }

    fetchRegistration();
  }, [fetchRegistration, isAuthenticated]);

  return {
    registration,
    loading,
    error,
    refetch: fetchRegistration,
  };
}
