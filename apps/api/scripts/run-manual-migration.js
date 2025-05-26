/**
 * Manual Migration Script for User Notes
 * 
 * This script runs the SQL migration directly for environments
 * where Prisma binaries are not accessible due to firewall restrictions.
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connected to database');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'manual-user-notes-migration.sql');
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    
    console.log('Executing migration SQL...');
    
    // Execute the SQL
    const result = await pool.query(sqlContent);
    
    console.log('Migration completed successfully');
    console.log('Migration results:', result);
    
    // Optionally record the migration in _prisma_migrations table if it exists
    try {
      const migrationRecord = {
        id: '20250526000000_add_user_notes_table',
        checksum: '4ef522c7cf6175bfe7cd73926214e5e27a4ff395c00885bb2ebd93dc81065828',
        finished_at: new Date(),
        migration_name: 'add_user_notes_table',
        logs: '',
        rolled_back_at: null,
        started_at: new Date(),
        applied_steps_count: 1,
      };
      
      await pool.query(`
        INSERT INTO _prisma_migrations 
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        migrationRecord.id,
        migrationRecord.checksum,
        migrationRecord.finished_at,
        migrationRecord.migration_name,
        migrationRecord.logs,
        migrationRecord.rolled_back_at,
        migrationRecord.started_at,
        migrationRecord.applied_steps_count,
      ]);
      console.log('Migration record added to _prisma_migrations table');
    } catch (err) {
      console.log('Note: Could not update _prisma_migrations table. This is normal if the table does not exist yet.');
    }
    
  } catch (err) {
    console.error('Error executing migration:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Unhandled error in migration script:', err);
  process.exit(1);
});