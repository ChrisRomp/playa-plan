# User Notes Migration Guide

This guide explains how to apply the migrations for the "Split internal notes field into dedicated user_notes table" feature.

## Migration Overview

The migration consists of three steps:

1. Create the `user_notes` table
2. Transfer existing `internalNotes` data from the `users` table
3. Remove the deprecated `internalNotes` column from the `users` table

## Using Prisma CLI (Recommended)

If your environment allows access to the Prisma binaries, you can use the standard Prisma CLI commands:

```bash
# Navigate to the API directory
cd apps/api

# Apply migrations
npx prisma migrate deploy
```

This will apply all pending migrations in the correct order.

## Using Manual Migration Script (Alternative)

If you encounter firewall issues or cannot access Prisma binaries, you can use the alternative manual migration script:

```bash
# Navigate to the API directory
cd apps/api

# Ensure dependencies are installed
npm install

# Run the manual migration script
npm run prisma:migrate:manual
```

This script will:
1. Connect directly to your database using the PostgreSQL client
2. Execute each migration SQL script in order
3. Track applied migrations if the `_prisma_migrations` table exists

## Verifying the Migration

After running the migration, you can verify that:

1. The `user_notes` table has been created
2. Existing notes have been transferred
3. The `internalNotes` column has been removed from the `users` table

You can check this by running:

```sql
-- Check table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'user_notes'
);

-- Check notes were transferred
SELECT u.email, un.note 
FROM user_notes un 
JOIN users u ON un.userId = u.id;

-- Verify column was removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='users' AND column_name='internalNotes';
```

## Troubleshooting

If you encounter issues:

1. Check database logs for specific SQL errors
2. Verify that your database connection is working
3. Confirm that your database user has the necessary permissions
4. Ensure that the PostgreSQL client package (pg) is installed

For further assistance, please contact the repository maintainers.