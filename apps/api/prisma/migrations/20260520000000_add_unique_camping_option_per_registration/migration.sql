-- Deduplicate camping_option_registrations: when multiple rows share the same
-- (registrationId, campingOptionId), keep the row with associated field values
-- (or the most recently updated row). Migrate field values from duplicate rows
-- to the kept row first, so ON DELETE CASCADE does not discard user data.

-- Step 1: Migrate field values from duplicate rows to the keeper.
-- The "keeper" for each group is the row with the most field values,
-- breaking ties by latest updatedAt.
WITH ranked AS (
  SELECT cor."id",
         cor."registrationId",
         cor."campingOptionId",
         ROW_NUMBER() OVER (
           PARTITION BY cor."registrationId", cor."campingOptionId"
           ORDER BY
             (SELECT COUNT(*) FROM "camping_option_field_values" v
              WHERE v."registrationId" = cor."id") DESC,
             cor."updatedAt" DESC
         ) AS rn
  FROM "camping_option_registrations" cor
  WHERE cor."registrationId" IS NOT NULL
),
keepers AS (
  SELECT "id" AS keeper_id, "registrationId", "campingOptionId"
  FROM ranked WHERE rn = 1
),
losers AS (
  SELECT r."id" AS loser_id, k.keeper_id
  FROM ranked r
  JOIN keepers k ON r."registrationId" = k."registrationId"
                AND r."campingOptionId" = k."campingOptionId"
  WHERE r.rn > 1
)
UPDATE "camping_option_field_values" fv
SET "registrationId" = l.keeper_id
FROM losers l
WHERE fv."registrationId" = l.loser_id
AND NOT EXISTS (
  SELECT 1 FROM "camping_option_field_values" existing
  WHERE existing."registrationId" = l.keeper_id
  AND existing."fieldId" = fv."fieldId"
);

-- Step 2: Delete duplicate rows (any field values still on these rows are
-- for fields the keeper already has, so cascade-deleting them is safe).
DELETE FROM "camping_option_registrations"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT cor."id",
           ROW_NUMBER() OVER (
             PARTITION BY cor."registrationId", cor."campingOptionId"
             ORDER BY
               (SELECT COUNT(*) FROM "camping_option_field_values" v
                WHERE v."registrationId" = cor."id") DESC,
               cor."updatedAt" DESC
           ) AS rn
    FROM "camping_option_registrations" cor
    WHERE cor."registrationId" IS NOT NULL
  ) sub
  WHERE sub.rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "camping_option_registrations_registrationId_campingOptionId_key" ON "camping_option_registrations"("registrationId", "campingOptionId");
