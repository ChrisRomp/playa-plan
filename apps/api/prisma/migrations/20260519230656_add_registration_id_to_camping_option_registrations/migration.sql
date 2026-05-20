-- AlterTable
ALTER TABLE "camping_option_registrations" ADD COLUMN "registrationId" TEXT;

-- Backfill: link each camping_option_registration to the user's existing
-- non-cancelled registration (at most one per user in current data).
UPDATE "camping_option_registrations"
SET "registrationId" = (
  SELECT "id"
  FROM "registrations"
  WHERE "registrations"."userId" = "camping_option_registrations"."userId"
    AND "registrations"."status" != 'CANCELLED'
  ORDER BY "registrations"."createdAt" DESC
  LIMIT 1
);

-- CreateIndex
CREATE INDEX "camping_option_registrations_registrationId_idx" ON "camping_option_registrations"("registrationId");

-- AddForeignKey
ALTER TABLE "camping_option_registrations" ADD CONSTRAINT "camping_option_registrations_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
