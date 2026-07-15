import { api } from '../api';

export const ADMIN_PAYMENT_PAGE_SIZE = 25;

export type ExternalPaymentMethod =
  | 'CASH'
  | 'CHECK'
  | 'PAYPAL'
  | 'STRIPE'
  | 'BANK_TRANSFER'
  | 'OTHER';

export interface AdminPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  externalMethod: ExternalPaymentMethod | null;
  externalReference: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  registrationId: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  registration: {
    id: string;
    year: number;
    status: string;
  } | null;
}

export interface AdminPaymentPage {
  payments: AdminPayment[];
  total: number;
}

export interface CreateExternalPaymentRequest {
  registrationId: string;
  amount: number;
  currency: string;
  externalMethod: ExternalPaymentMethod;
  externalReference?: string;
  idempotencyKey: string;
}

export const adminPaymentsApi = {
  getPayments: async (
    skip = 0,
    take = ADMIN_PAYMENT_PAGE_SIZE,
  ): Promise<AdminPaymentPage> => {
    const params = new URLSearchParams({
      skip: skip.toString(),
      take: take.toString(),
    });
    const response = await api.get(`/payments/admin?${params.toString()}`);
    return response.data;
  },

  recordExternalPayment: async (
    request: CreateExternalPaymentRequest,
  ): Promise<AdminPayment> => {
    const response = await api.post('/payments/external', request);
    return response.data;
  },
};
