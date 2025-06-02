-- CreateEnum
CREATE TYPE "AdminAuditActionType" AS ENUM ('REGISTRATION_EDIT', 'REGISTRATION_CANCEL', 'PAYMENT_REFUND', 'WORK_SHIFT_ADD', 'WORK_SHIFT_REMOVE', 'WORK_SHIFT_MODIFY', 'CAMPING_OPTION_ADD', 'CAMPING_OPTION_REMOVE', 'CAMPING_OPTION_MODIFY');

-- CreateEnum
CREATE TYPE "AdminAuditTargetType" AS ENUM ('REGISTRATION', 'USER', 'PAYMENT', 'WORK_SHIFT', 'CAMPING_OPTION');

-- CreateTable
CREATE TABLE "admin_audit" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "actionType" "AdminAuditActionType" NOT NULL,
    "targetRecordType" "AdminAuditTargetType" NOT NULL,
    "targetRecordId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "reason" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
