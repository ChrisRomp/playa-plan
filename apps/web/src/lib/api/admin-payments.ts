import { api } from '../api';

export const ADMIN_PAYMENT_PAGE_SIZE = 25;

export type ExternalPaymentMethod =
  | 'CASH'
  | 'CHECK'
  | 'PAYPAL'
  | 'STRIPE'
  | 'BANK_TRANSFER'
  | 'OTHER';

export type RefundExecutionMode = 'MANUAL' | 'STRIPE';
export type PaymentRefundStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';
export type RefundRegistrationStatus = 'PENDING' | 'CONFIRMED' | 'WAITLISTED';
export type RefundCommandOutcome = 'SUCCEEDED' | 'FAILED' | 'PENDING_UNKNOWN';

export interface AdminPaymentRefund {
  id: string;
  amountCents: number;
  currency: string;
  executionMode: RefundExecutionMode;
  status: PaymentRefundStatus;
  reason: string | null;
  externalReference: string | null;
  resultingRegistrationStatus: RefundRegistrationStatus | null;
  createdAt: string;
  updatedAt: string;
}

export type ExternalPaymentSearchRegistrationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'WAITLISTED'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_DECLINED';

export interface ExternalPaymentSearchRegistration {
  id: string;
  year: number;
  status: ExternalPaymentSearchRegistrationStatus;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

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
  refunds: AdminPaymentRefund[];
  paymentAmountCents: number | null;
  successfulRefundCents: number;
  pendingRefundCents: number;
  availableRefundCents: number;
  refundUnavailableReason: string | null;
  stripeRefundEligible: boolean;
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

export type RefundAmountSelection =
  | {
      amountCents: number;
      fullRefund?: never;
    }
  | {
      amountCents?: never;
      fullRefund: true;
    };

interface CreateRefundRequestFields {
  reason?: string;
  resultingRegistrationStatus?: RefundRegistrationStatus;
  idempotencyKey: string;
}

export type CreateManualRefundRequest = RefundAmountSelection &
  CreateRefundRequestFields & {
    executionMode: 'MANUAL';
    externalReference?: string;
  };

export type CreateStripeRefundRequest = RefundAmountSelection &
  CreateRefundRequestFields & {
    executionMode: 'STRIPE';
    externalReference?: never;
  };

export type CreateRefundRequest = CreateManualRefundRequest | CreateStripeRefundRequest;

export interface RefundCommandResult {
  payment: AdminPayment;
  refund: AdminPaymentRefund;
  paymentAmountCents: number | null;
  successfulRefundCents: number;
  pendingRefundCents: number;
  availableRefundCents: number;
  refundUnavailableReason: string | null;
  outcome: RefundCommandOutcome;
}

export const adminPaymentsApi = {
  getPayments: async (skip = 0, take = ADMIN_PAYMENT_PAGE_SIZE): Promise<AdminPaymentPage> => {
    const params = new URLSearchParams({
      skip: skip.toString(),
      take: take.toString(),
    });
    const response = await api.get(`/payments/admin?${params.toString()}`);
    return response.data;
  },

  recordExternalPayment: async (request: CreateExternalPaymentRequest): Promise<AdminPayment> => {
    const response = await api.post('/payments/external', request);
    return response.data;
  },

  createRefund: async (
    paymentId: string,
    request: CreateRefundRequest
  ): Promise<RefundCommandResult> => {
    const response = await api.post(`/payments/${paymentId}/refunds`, request);
    return response.data;
  },

  retryStripeRefund: async (
    paymentId: string,
    refundId: string
  ): Promise<RefundCommandResult> => {
    const response = await api.post(`/payments/${paymentId}/refunds/${refundId}/retry`);
    return response.data;
  },
};
