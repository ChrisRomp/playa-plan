-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('TICKET_RECEIPT_SIGNATURE');

-- AlterEnum
ALTER TYPE "AdminAuditActionType" ADD VALUE 'REPORT_CONFIGURATION_MODIFY';

-- AlterEnum
ALTER TYPE "AdminAuditTargetType" ADD VALUE 'REPORT_CONFIGURATION';

-- CreateTable
CREATE TABLE "report_configurations" (
    "id" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_configurations_reportType_key"
ON "report_configurations"("reportType");
