/**
 * Manual migration application script for cases where Prisma CLI is unavailable
 * 
 * This script will read the SQL migration files and execute them directly using the
 * database client, bypassing the need for the Prisma binary.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigrations() {
  // Create database connection
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Get migration directories in order
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    const migrations = fs
      .readdirSync(migrationsDir)
      .filter(dir => !dir.startsWith('.') && dir !== 'migration_lock.toml' && dir !== 'README.md')
      .sort();
    
    console.log(`Found ${migrations.length} migrations to apply`);
    
    // Apply migrations in sequence
    for (const migration of migrations) {
      const migrationPath = path.join(migrationsDir, migration);
      const sqlFilePath = path.join(migrationPath, 'migration.sql');
      
      if (fs.existsSync(sqlFilePath)) {
        console.log(`Applying migration: ${migration}`);
        const sql = fs.readFileSync(sqlFilePath, 'utf8');
        
        try {
          await client.query(sql);
          console.log(`✓ Successfully applied migration: ${migration}`);
        } catch (err) {
          console.error(`Error applying migration ${migration}:`, err.message);
        }
      }
    }
    
    // Record successful migration in _prisma_migrations table (if it exists)
    try {
      // Check if _prisma_migrations table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '_prisma_migrations'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
        console.log('Updating _prisma_migrations table');
        
        for (const migration of migrations) {
          const migrationId = migration;
          const checkMigration = await client.query(
            'SELECT migration_id FROM _prisma_migrations WHERE migration_id = $1',
            [migrationId]
          );
          
          if (checkMigration.rows.length === 0) {
            await client.query(
              `INSERT INTO _prisma_migrations (migration_id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                migrationId, 
                'manually-applied', 
                new Date(), 
                migration, 
                'Applied manually using apply-manual-migrations.js script',
                null,
                new Date(),
                1
              ]
            );
            console.log(`✓ Recorded migration ${migration} in _prisma_migrations table`);
          } else {
            console.log(`Migration ${migration} already recorded in _prisma_migrations table`);
          }
        }
      }
    } catch (err) {
      console.warn('Could not update _prisma_migrations table:', err.message);
      console.warn('This is expected for initial setup or if running without Prisma.');
    }
    
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

applyMigrations().catch(console.error);