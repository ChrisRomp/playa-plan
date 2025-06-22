import * as path from 'path';
import { Storage, GetFilesOptions } from '@google-cloud/storage';
import { BackupConfig } from '../backup-config';
import { StorageProvider, BackupFileMetadata } from '../storage-provider.interface';
import { BackupResult } from '../backup-service';
import { generateObjectKey, getBackupTypeFromFileName } from '../utils/storage-utils';

/**
 * Configuration options for Google Cloud Storage client
 */
interface StorageOptions {
  keyFilename?: string;
}

/**
 * Google Cloud Storage provider for database backups
 */
export class GCSStorageProvider implements StorageProvider {
  private storage: Storage;
  private bucketName: string;
  
  /**
   * Creates a new Google Cloud Storage provider
   * @param config Backup configuration
   */
  constructor(private readonly config: BackupConfig) {
    if (!config.storage.gcs) {
      throw new Error('GCS storage configuration is required');
    }
    
    const { bucket, keyFilePath } = config.storage.gcs;
    
    // Initialize GCS client
    const options: StorageOptions = {};
    if (keyFilePath) {
      options.keyFilename = keyFilePath;
    }
    
    this.storage = new Storage(options);
    this.bucketName = bucket;
  }
  
  /**
   * Upload a backup file to Google Cloud Storage
   * @param backupResult Result of a backup operation
   * @returns Promise that resolves with the updated backup result
   */
  public async uploadFile(backupResult: BackupResult): Promise<BackupResult> {
    try {
      const { fileName, filePath } = backupResult;
      const objectName = this.getObjectName(fileName);
      
      // Upload file to GCS
      await this.storage.bucket(this.bucketName).upload(filePath, {
        destination: objectName,
        metadata: {
          contentType: 'application/octet-stream',
          metadata: {
            backupType: backupResult.backupType,
            timestamp: backupResult.timestamp.toISOString(),
          },
        },
      });
      
      return {
        ...backupResult,
        success: true,
        message: `Successfully uploaded ${fileName} to Google Cloud Storage: ${this.bucketName}/${objectName}`,
      };
    } catch (error) {
      return {
        ...backupResult,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        message: `Failed to upload ${backupResult.fileName} to Google Cloud Storage: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * List all backup files in Google Cloud Storage
   * @returns Promise that resolves with a list of backup file metadata
   */
  public async listFiles(): Promise<BackupFileMetadata[]> {
    try {
      const files: BackupFileMetadata[] = [];
      const prefix = this.config.storage.gcs?.prefix || '';
      
      // List all objects in the bucket with the specified prefix
      const options: GetFilesOptions = {
        prefix,
      };
      
      const [fileObjects] = await this.storage.bucket(this.bucketName).getFiles(options);
      
      for (const file of fileObjects) {
        const [metadata] = await file.getMetadata();
        
        // Extract backup type from metadata or filename
        const backupType = 
          (metadata.metadata?.backupType as 'full' | 'schema' | 'wal') || 
          getBackupTypeFromFileName(file.name);
        
        files.push({
          fileName: path.basename(file.name),
          filePath: file.name,
          fileSize: parseInt(metadata.size || '0', 10),
          lastModified: new Date(metadata.updated || Date.now()),
          backupType,
          metadata: metadata.metadata,
        });
      }
      
      return files;
    } catch (error) {
      console.error('Failed to list files from Google Cloud Storage:', error);
      throw error;
    }
  }
  
  /**
   * Delete a backup file from Google Cloud Storage
   * @param fileName Name of the file to delete
   * @returns Promise that resolves when deletion is complete
   */
  public async deleteFile(fileName: string): Promise<void> {
    try {
      const objectName = this.getObjectName(fileName);
      
      // Delete the object
      await this.storage.bucket(this.bucketName).file(objectName).delete();
      
      console.log(`Successfully deleted ${fileName} from Google Cloud Storage`);
    } catch (error) {
      console.error(`Failed to delete ${fileName} from Google Cloud Storage:`, error);
      throw error;
    }
  }
  
  /**
   * Check if a backup file exists in Google Cloud Storage
   * @param fileName Name of the file to check
   * @returns Promise that resolves with true if the file exists
   */
  public async fileExists(fileName: string): Promise<boolean> {
    try {
      const objectName = this.getObjectName(fileName);
      
      // Check if the object exists
      const [exists] = await this.storage.bucket(this.bucketName).file(objectName).exists();
      return exists;
    } catch (error) {
      console.error(`Failed to check if ${fileName} exists in Google Cloud Storage:`, error);
      return false;
    }
  }
  
  /**
   * Generate the full GCS object name for a file
   * @param fileName Name of the file
   * @returns Full GCS object name
   */
  private getObjectName(fileName: string): string {
    return generateObjectKey(fileName, this.config.storage.gcs?.prefix || '');
  }
}
