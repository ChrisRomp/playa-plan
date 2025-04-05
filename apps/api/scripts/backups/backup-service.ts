import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { BackupConfig } from './backup-config';

/**
 * Result of a database backup operation
 */
export interface BackupResult {
  success: boolean;
  fileName: string;
  filePath: string;
  fileSize: number;
  timestamp: Date;
  backupType: 'full' | 'schema' | 'wal';
  message?: string;
  error?: Error;
}

/**
 * Base class for database backup services
 */
export abstract class BackupService {
  constructor(protected config: BackupConfig) {}

  /**
   * Create a full database backup using pg_dump
   * @returns Backup result with file information
   */
  public createFullBackup(): BackupResult {
    try {
      const timestamp = new Date();
      const fileName = this.generateBackupFileName(timestamp, 'full');
      const localFilePath = this.getLocalBackupPath(fileName);
      
      // Ensure directory exists
      const directory = path.dirname(localFilePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      // Build pg_dump command
      const command = this.buildPgDumpCommand(localFilePath);
      
      // Execute pg_dump
      execSync(command, { stdio: 'inherit' });
      
      // Get file size
      const stats = fs.statSync(localFilePath);
      
      return {
        success: true,
        fileName,
        filePath: localFilePath,
        fileSize: stats.size,
        timestamp,
        backupType: 'full',
        message: `Successfully created full backup: ${fileName}`
      };
    } catch (error) {
      return {
        success: false,
        fileName: '',
        filePath: '',
        fileSize: 0,
        timestamp: new Date(),
        backupType: 'full',
        error: error instanceof Error ? error : new Error(String(error)),
        message: `Failed to create full backup: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Create a schema-only backup using pg_dump with --schema-only flag
   * @returns Backup result with file information
   */
  public createSchemaBackup(): BackupResult {
    try {
      const timestamp = new Date();
      const fileName = this.generateBackupFileName(timestamp, 'schema');
      const localFilePath = this.getLocalBackupPath(fileName);
      
      // Ensure directory exists
      const directory = path.dirname(localFilePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      // Build pg_dump command with schema-only flag
      const command = this.buildPgDumpCommand(localFilePath, true);
      
      // Execute pg_dump
      execSync(command, { stdio: 'inherit' });
      
      // Get file size
      const stats = fs.statSync(localFilePath);
      
      return {
        success: true,
        fileName,
        filePath: localFilePath,
        fileSize: stats.size,
        timestamp,
        backupType: 'schema',
        message: `Successfully created schema backup: ${fileName}`
      };
    } catch (error) {
      return {
        success: false,
        fileName: '',
        filePath: '',
        fileSize: 0,
        timestamp: new Date(),
        backupType: 'schema',
        error: error instanceof Error ? error : new Error(String(error)),
        message: `Failed to create schema backup: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Archive WAL segments for point-in-time recovery
   * @param walFile Path to the WAL file
   * @returns Backup result with file information
   */
  public archiveWAL(walFile: string): BackupResult {
    try {
      const timestamp = new Date();
      const fileName = path.basename(walFile);
      const localFilePath = path.join(this.config.walArchiving.directory, fileName);
      
      // Ensure directory exists
      const directory = path.dirname(localFilePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      
      // Copy WAL file to archive directory
      fs.copyFileSync(walFile, localFilePath);
      
      // Get file size
      const stats = fs.statSync(localFilePath);
      
      return {
        success: true,
        fileName,
        filePath: localFilePath,
        fileSize: stats.size,
        timestamp,
        backupType: 'wal',
        message: `Successfully archived WAL segment: ${fileName}`
      };
    } catch (error) {
      return {
        success: false,
        fileName: path.basename(walFile),
        filePath: '',
        fileSize: 0,
        timestamp: new Date(),
        backupType: 'wal',
        error: error instanceof Error ? error : new Error(String(error)),
        message: `Failed to archive WAL segment: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Upload a backup to the configured storage provider
   * @param backupResult Result of a database backup operation
   * @returns Promise that resolves when upload is complete
   */
  public abstract uploadBackup(backupResult: BackupResult): Promise<BackupResult>;

  /**
   * Delete outdated backups based on retention policy
   * @returns Promise that resolves when deletion is complete
   */
  public abstract applyRetentionPolicy(): Promise<void>;

  /**
   * Generate a backup file name based on timestamp and type
   * @param timestamp Timestamp for the backup
   * @param type Type of backup (full, schema, wal)
   * @returns Formatted backup file name
   */
  protected generateBackupFileName(timestamp: Date, type: 'full' | 'schema' | 'wal'): string {
    const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').replace('T', '_');
    const extension = this.config.storage.compression.enabled ? 'sql.gz' : 'sql';
    return `${this.config.database.name}_${type}_${dateStr}.${extension}`;
  }
  
  /**
   * Get the local file path for a backup file
   * @param fileName Name of the backup file
   * @returns Local file path for the backup
   */
  protected getLocalBackupPath(fileName: string): string {
    return path.join(this.config.storage.local?.path || './backups', fileName);
  }
  
  /**
   * Build the pg_dump command with appropriate options
   * @param outputFile Path to output file
   * @param schemaOnly Whether to only dump schema (no data)
   * @returns pg_dump command string
   */
  protected buildPgDumpCommand(outputFile: string, schemaOnly = false): string {
    const { host, port, name, username, password, schema } = this.config.database;
    const compression = this.config.storage.compression;
    
    let command = `PGPASSWORD=${password} pg_dump -h ${host} -p ${port} -U ${username} -d ${name}`;
    
    // Add options
    if (schema) {
      command += ` -n ${schema}`;
    }
    
    if (schemaOnly) {
      command += ' --schema-only';
    }
    
    // Add format
    command += ' -Fp'; // Plain text format
    
    // Handle compression
    if (compression.enabled) {
      command += ` | gzip -${compression.level} > ${outputFile}`;
    } else {
      command += ` > ${outputFile}`;
    }
    
    return command;
  }
}
