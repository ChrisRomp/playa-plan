-- AlterEnum
ALTER TYPE "AdminAuditActionType" ADD VALUE 'APPLICATION_APPROVE';
ALTER TYPE "AdminAuditActionType" ADD VALUE 'APPLICATION_DECLINE';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'APPLICATION_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'APPLICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'APPLICATION_DECLINED';

-- AlterEnum
ALTER TYPE "RegistrationStatus" ADD VALUE 'APPLICATION_SUBMITTED';
ALTER TYPE "RegistrationStatus" ADD VALUE 'APPLICATION_APPROVED';
ALTER TYPE "RegistrationStatus" ADD VALUE 'APPLICATION_DECLINED';

-- AlterTable
ALTER TABLE "core_config" ADD COLUMN     "applicationApprovalRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "decisionMessage" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "autoApproveRegistration" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "registrations_reviewedById_idx" ON "registrations"("reviewedById");

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
