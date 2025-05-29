-- CreateEnum
CREATE TYPE "EmailAuditStatus" AS ENUM ('SENT', 'FAILED', 'DISABLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'EMAIL_AUTHENTICATION';
ALTER TYPE "NotificationType" ADD VALUE 'EMAIL_CHANGE';
ALTER TYPE "NotificationType" ADD VALUE 'REGISTRATION_ERROR';

-- AlterTable
ALTER TABLE "core_config" ADD COLUMN     "emailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "email_audit" (
    "id" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "ccEmails" TEXT,
    "bccEmails" TEXT,
    "subject" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "status" "EmailAuditStatus" NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_audit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "email_audit" ADD CONSTRAINT "email_audit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
