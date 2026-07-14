-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- CreateEnum
CREATE TYPE "ExternalPaymentMethod" AS ENUM ('CASH', 'CHECK', 'PAYPAL', 'STRIPE', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "RefundExecutionMode" AS ENUM ('MANUAL', 'STRIPE');

-- CreateEnum
CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "payments"
ADD COLUMN "externalMethod" "ExternalPaymentMethod",
ADD COLUMN "externalReference" VARCHAR(255),
ADD COLUMN "idempotencyKey" UUID;

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "executionMode" "RefundExecutionMode" NOT NULL,
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(500),
    "externalReference" VARCHAR(255),
    "providerRefundId" VARCHAR(255),
    "idempotencyKey" UUID NOT NULL,
    "processedByUserId" TEXT NOT NULL,
    "resultingRegistrationStatus" "RegistrationStatus",
    "failureMessage" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_refunds_amountCents_positive_check" CHECK ("amountCents" > 0),
    CONSTRAINT "payment_refunds_currency_uppercase_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "payment_refunds_resultingRegistrationStatus_check"
      CHECK (
        "resultingRegistrationStatus" IS NULL
        OR "resultingRegistrationStatus" IN (
          'PENDING'::"RegistrationStatus",
          'CONFIRMED'::"RegistrationStatus",
          'WAITLISTED'::"RegistrationStatus"
        )
      )
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_providerRefundId_key" ON "payment_refunds"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_idempotencyKey_key" ON "payment_refunds"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_refunds_paymentId_status_idx" ON "payment_refunds"("paymentId", "status");

-- AddForeignKey
ALTER TABLE "payment_refunds"
ADD CONSTRAINT "payment_refunds_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds"
ADD CONSTRAINT "payment_refunds_processedByUserId_fkey"
FOREIGN KEY ("processedByUserId") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
