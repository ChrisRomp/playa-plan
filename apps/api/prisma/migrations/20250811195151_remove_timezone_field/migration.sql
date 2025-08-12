-- Remove unused timezone field from core_config table
ALTER TABLE "core_config" DROP COLUMN "timeZone";