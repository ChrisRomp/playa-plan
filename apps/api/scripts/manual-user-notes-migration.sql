-- Manual migration script for environments with restricted access to Prisma binaries
-- Run this script directly against your PostgreSQL database

-- Step 1: Create the user_notes table
CREATE TABLE IF NOT EXISTS "user_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_notes_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS "user_notes_userId_idx" ON "user_notes"("userId");
CREATE INDEX IF NOT EXISTS "user_notes_createdById_idx" ON "user_notes"("createdById");

-- Step 3: Add foreign key relationships
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_createdById_fkey" 
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: Migrate existing internal notes data
INSERT INTO "user_notes" ("id", "userId", "note", "createdById", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(), -- Generate a UUID for the note
  u.id as "userId", -- User ID from the users table
  u."internalNotes" as "note", -- The content of the internal note
  (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1) as "createdById", -- Find an admin user for the created by field
  u."updatedAt" as "createdAt", -- Use the last update time as created time
  CURRENT_TIMESTAMP as "updatedAt" -- Set current time as updated at
FROM "users" u
WHERE u."internalNotes" IS NOT NULL AND u."internalNotes" != '';

-- Step 5: Remove the internalNotes column from the users table
ALTER TABLE "users" DROP COLUMN IF EXISTS "internalNotes";

-- Step 6: Verify the migration
SELECT 'User Notes Table Created' AS migration_step, 
  (SELECT COUNT(*) FROM "user_notes") AS notes_count;