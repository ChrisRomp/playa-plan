import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export interface Camp {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  location: string;
  capacity: number;
  isActive: boolean;
}

export const useCamps = () => {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCamps = async () => {
    setLoading(true);
    try {
      const response = await api.get('/camps');
      setCamps(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching camps:', err);
      setError('Failed to load camps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCamps();
  }, []);

  return {
    camps,
    loading,
    error,
    fetchCamps
  };
};
