import { api } from '../api';

// TODO: Replace with actual API types when implemented
interface Registration {
  id: string;
  year: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    playaName?: string;
    role: string;
  };
  jobs: Array<{
    id: string;
    job: {
      id: string;
      name: string;
      category?: {
        name: string;
      };
    };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
  }>;
}

interface RegistrationEditData {
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
  jobIds: string[];
  campingOptionIds: string[];
  reason: string;
  sendNotification: boolean;
}

interface RegistrationCancelData {
  reason: string;
  sendNotification: boolean;
  processRefund: boolean;
}

interface RegistrationFilters {
  year?: number;
  status?: string;
  email?: string;
  name?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedRegistrationsResponse {
  registrations: Registration[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AuditRecord {
  id: string;
  adminUserId: string;
  actionType: string;
  targetRecordType: string;
  targetRecordId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason: string;
  transactionId?: string;
  createdAt: string;
  adminUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * API client for admin registration management operations
 */
export const adminRegistrationsApi = {
  /**
   * Get paginated list of registrations with optional filters
   */
  getRegistrations: async (filters: RegistrationFilters = {}): Promise<PaginatedRegistrationsResponse> => {
    const params = new URLSearchParams();
    
    if (filters.year) params.append('year', filters.year.toString());
    if (filters.status) params.append('status', filters.status);
    if (filters.email) params.append('email', filters.email);
    if (filters.name) params.append('name', filters.name);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/admin/registrations?${params.toString()}`);
    return response.data;
  },

  /**
   * Edit a registration
   */
  editRegistration: async (registrationId: string, data: RegistrationEditData): Promise<void> => {
    await api.put(`/admin/registrations/${registrationId}`, data);
  },

  /**
   * Cancel a registration
   */
  cancelRegistration: async (registrationId: string, data: RegistrationCancelData): Promise<void> => {
    await api.delete(`/admin/registrations/${registrationId}`, { data });
  },

  /**
   * Get audit trail for a registration
   */
  getAuditTrail: async (registrationId: string): Promise<AuditRecord[]> => {
    const response = await api.get(`/admin/registrations/${registrationId}/audit-trail`);
    return response.data;
  },
};

export default adminRegistrationsApi; 