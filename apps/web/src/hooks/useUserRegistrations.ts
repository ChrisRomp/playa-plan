import { useState, useEffect, useCallback } from 'react';
import { registrations, Registration } from '../lib/api';
import { useAuth } from '../store/authUtils';

interface UseUserRegistrationsResult {
  registrations: Registration[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing user registrations
 * @returns An object containing registrations data, loading state, error state, and refetch function
 */
export function useUserRegistrations(): UseUserRegistrationsResult {
  const { isAuthenticated } = useAuth();
  const [userRegistrations, setUserRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistrations = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await registrations.getMyRegistrations();
      setUserRegistrations(data);
    } catch (err) {
      setError('Failed to fetch registrations');
      console.error('Error fetching user registrations:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  return {
    registrations: userRegistrations,
    loading,
    error,
    refetch: fetchRegistrations,
  };
} 