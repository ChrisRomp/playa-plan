import { PaymentStatus } from '@prisma/client';

export const LEGACY_WRITABLE_PAYMENT_STATUSES = [
  PaymentStatus.PENDING,
  PaymentStatus.COMPLETED,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
] as const;
