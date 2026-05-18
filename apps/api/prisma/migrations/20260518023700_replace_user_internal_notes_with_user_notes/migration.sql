-- Replace the static User.internalNotes field with a 1:many UserNote table.
-- Migrate any existing non-empty internalNotes content into a single UserNote
-- entry attributed to the same user (no original author was tracked), then
-- drop the column.

CREATE TABLE "user_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_notes_userId_idx" ON "user_notes"("userId");
CREATE INDEX "user_notes_authorId_idx" ON "user_notes"("authorId");

ALTER TABLE "user_notes"
  ADD CONSTRAINT "user_notes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notes"
  ADD CONSTRAINT "user_notes_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- Migrate any existing internal notes into the new table.
-- The original column did not record an author, so the migrated note is
-- attributed to the user themselves; admins can edit/delete after migration.
INSERT INTO "user_notes" ("id", "userId", "authorId", "content", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", "id", "internalNotes", NOW(), NOW()
FROM "users"
WHERE "internalNotes" IS NOT NULL AND length(btrim("internalNotes")) > 0;

ALTER TABLE "users" DROP COLUMN "internalNotes";
