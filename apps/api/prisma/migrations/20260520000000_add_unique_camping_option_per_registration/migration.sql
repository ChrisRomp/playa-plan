-- Deduplicate: if any rows have the same registrationId + campingOptionId,
-- keep only the earliest one (by createdAt).
DELETE FROM "camping_option_registrations"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id",
           ROW_NUMBER() OVER (
             PARTITION BY "registrationId", "campingOptionId"
             ORDER BY "createdAt" ASC
           ) AS rn
    FROM "camping_option_registrations"
    WHERE "registrationId" IS NOT NULL
  ) sub
  WHERE sub.rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "camping_option_registrations_registrationId_campingOptionId_key" ON "camping_option_registrations"("registrationId", "campingOptionId");
