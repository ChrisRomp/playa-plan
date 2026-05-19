-- AlterTable
ALTER TABLE "camping_option_registrations" ADD COLUMN "registration_id" TEXT;

-- Backfill: link each camping_option_registration to the user's existing
-- non-cancelled registration (at most one per user in current data).
UPDATE "camping_option_registrations"
SET "registration_id" = (
  SELECT "id"
  FROM "registrations"
  WHERE "registrations"."user_id" = "camping_option_registrations"."user_id"
    AND "registrations"."status" != 'CANCELLED'
  ORDER BY "registrations"."created_at" DESC
  LIMIT 1
);

-- CreateIndex
CREATE INDEX "camping_option_registrations_registration_id_idx" ON "camping_option_registrations"("registration_id");

-- AddForeignKey
ALTER TABLE "camping_option_registrations" ADD CONSTRAINT "camping_option_registrations_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
