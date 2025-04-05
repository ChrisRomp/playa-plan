import { BackupResult } from './backup-service';

/**
 * Interface for backup storage providers
 */
export interface StorageProvider {
  /**
   * Upload a backup file to the storage provider
   * @param backupResult Result of a backup operation
   * @returns Promise that resolves with the updated backup result
   */
  uploadFile(backupResult: BackupResult): Promise<BackupResult>;
  
  /**
   * List all backup files in the storage provider
   * @returns Promise that resolves with a list of backup file metadata
   */
  listFiles(): Promise<BackupFileMetadata[]>;
  
  /**
   * Delete a backup file from the storage provider
   * @param fileName Name of the file to delete
   * @returns Promise that resolves when deletion is complete
   */
  deleteFile(fileName: string): Promise<void>;
  
  /**
   * Check if a backup file exists in the storage provider
   * @param fileName Name of the file to check
   * @returns Promise that resolves with true if the file exists
   */
  fileExists(fileName: string): Promise<boolean>;
}

/**
 * Metadata for a backup file
 */
export interface BackupFileMetadata {
  /** Name of the file */
  fileName: string;
  /** Full path or key to the file */
  filePath: string;
  /** Size of the file in bytes */
  fileSize: number;
  /** Last modified timestamp */
  lastModified: Date;
  /** Type of backup (full, schema, wal) */
  backupType: 'full' | 'schema' | 'wal';
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}
