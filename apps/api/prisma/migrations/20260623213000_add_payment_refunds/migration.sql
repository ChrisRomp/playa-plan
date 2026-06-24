-- Add partial refund status for payments with some refunded amount and remaining balance.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';

-- Track admin-recorded payments that happened outside the PlayaPlan portal.
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "externalPaymentMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "externalPaymentReference" TEXT,
  ADD COLUMN IF NOT EXISTS "recordedByUserId" TEXT;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_recordedByUserId_fkey"
  FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Legacy external payments were stored as STRIPE with providerRefId values like manual:<reference>.
-- Reclassify those rows so they cannot expose automated Stripe refund actions.
UPDATE "payments"
SET
  "provider" = 'MANUAL',
  "externalPaymentMethod" = COALESCE("externalPaymentMethod", 'Externally recorded'),
  "externalPaymentReference" = COALESCE(
    "externalPaymentReference",
    NULLIF(regexp_replace("providerRefId", '^manual:?', ''), '')
  ),
  "providerRefId" = NULL
WHERE "provider" = 'STRIPE'
  AND "providerRefId" LIKE 'manual%';

CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "payment_refunds" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "PaymentRefundStatus" NOT NULL DEFAULT 'SUCCEEDED',
  "processorRefund" BOOLEAN NOT NULL DEFAULT false,
  "providerRefundId" TEXT,
  "reason" TEXT,
  "resultingRegistrationStatus" "RegistrationStatus",
  "processedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_refunds_paymentId_idx" ON "payment_refunds"("paymentId");
CREATE INDEX "payment_refunds_processedByUserId_idx" ON "payment_refunds"("processedByUserId");

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_processedByUserId_fkey"
  FOREIGN KEY ("processedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "AdminAuditActionType" ADD VALUE IF NOT EXISTS 'PAYMENT_RECORD';
