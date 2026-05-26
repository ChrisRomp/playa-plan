import { useState, useCallback } from 'react';
import { api } from '../lib/api';

export interface Application {
  id: string;
  userId: string;
  year: number;
  status: 'APPLICATION_SUBMITTED' | 'APPLICATION_APPROVED' | 'APPLICATION_DECLINED';
  reviewedById?: string | null;
  reviewedAt?: string | null;
  decisionMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    playaName?: string | null;
  };
  campingOptionRegistrations?: Array<{
    id: string;
    campingOption: { id: string; name: string };
  }>;
}

export interface ApplicationsQuery {
  status?: string;
  year?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ApplicationsResponse {
  data: Application[];
  total: number;
  page: number;
  limit: number;
}

export function useApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async (query: ApplicationsQuery = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.status) params.set('status', query.status);
      if (query.year) params.set('year', String(query.year));
      if (query.search) params.set('search', query.search);
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));

      const queryString = params.toString();
      const endpoint = queryString ? `/admin/applications?${queryString}` : '/admin/applications';
      const response = await api.get<ApplicationsResponse>(endpoint);
      setApplications(response.data.data);
      setTotal(response.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  }, []);

  const approveApplication = useCallback(async (id: string, message?: string) => {
    const response = await api.patch(`/admin/applications/${id}/approve`, { message });
    return response.data;
  }, []);

  const declineApplication = useCallback(async (id: string, message: string) => {
    const response = await api.patch(`/admin/applications/${id}/decline`, { message });
    return response.data;
  }, []);

  const bulkProcess = useCallback(async (ids: string[], action: 'approve' | 'decline', message?: string) => {
    const response = await api.patch('/admin/applications/bulk', { ids, action, message });
    return response.data;
  }, []);

  const getApplicationDetail = useCallback(async (id: string) => {
    const response = await api.get<Application>(`/admin/applications/${id}`);
    return response.data;
  }, []);

  return {
    applications,
    total,
    loading,
    error,
    fetchApplications,
    approveApplication,
    declineApplication,
    bulkProcess,
    getApplicationDetail,
  };
}
