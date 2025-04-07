import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { StorageProvider } from './storage.provider';
import { BackupConfig } from '../config/backup-config';
import { BackupResult, BackupFileMetadata } from '../types/backup.types';
import { generateObjectKey, getBackupTypeFromFileName } from '../utils/storage-utils';

/**
 * AWS S3 storage provider for database backups
 */
export class S3StorageProvider implements StorageProvider {
  private s3Client: S3Client;

  /**
   * Create a new S3StorageProvider
   * @param config Backup configuration
   */
  constructor(private readonly config: BackupConfig) {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.config.storage.s3?.region || 'us-east-1',
      credentials: {
        accessKeyId: this.config.storage.s3?.accessKeyId || '',
        secretAccessKey: this.config.storage.s3?.secretAccessKey || '',
      },
    });
  }

  /**
   * Upload a backup file to S3
   * @param backupResult Backup result containing file info
   * @returns Updated backup result with storage info
   */
  public async uploadFile(backupResult: BackupResult): Promise<BackupResult> {
    if (!backupResult.filePath) {
      throw new Error('Backup file path is missing');
    }

    const bucketName = this.config.storage.s3?.bucket;
    if (!bucketName) {
      throw new Error('S3 bucket name is not configured');
    }

    try {
      // Generate object key
      const fileName = backupResult.fileName;
      const key = generateObjectKey(fileName, this.config.storage.s3?.prefix || '');

      // Read file as buffer
      const fileContent = await Bun.file(backupResult.filePath).arrayBuffer();
      
      // Upload file to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: fileContent,
          ContentType: 'application/octet-stream',
          Metadata: {
            'backup-type': backupResult.type,
            'database-name': backupResult.databaseName,
            'backup-date': backupResult.timestamp.toISOString(),
          },
        })
      );

      // Update backup result with remote storage info
      return {
        ...backupResult,
        storagePath: `s3://${bucketName}/${key}`,
        storageProvider: 's3',
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to upload backup to S3: ${err.message}`);
    }
  }

  /**
   * List all backup files in S3
   * @returns Array of backup file metadata
   */
  public async listFiles(): Promise<BackupFileMetadata[]> {
    const bucketName = this.config.storage.s3?.bucket;
    if (!bucketName) {
      throw new Error('S3 bucket name is not configured');
    }

    try {
      const prefix = this.config.storage.s3?.prefix || '';
      
      // List all objects in the bucket with the specified prefix
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
        })
      );

      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }

      // Map S3 objects to backup metadata
      return response.Contents.map((object) => {
        if (!object.Key) {
          throw new Error('S3 object key is missing');
        }

        // Extract file name from key
        const keyParts = object.Key.split('/');
        const fileName = keyParts[keyParts.length - 1];
        
        // Get backup type from file name
        const backupType = getBackupTypeFromFileName(fileName);
        
        return {
          fileName,
          fullPath: `s3://${bucketName}/${object.Key}`,
          size: object.Size || 0,
          lastModified: object.LastModified || new Date(),
          type: backupType,
          storageProvider: 's3',
        };
      });
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to list backups from S3: ${err.message}`);
    }
  }

  /**
   * Delete a backup file from S3
   * @param fileName Name of the file to delete
   */
  public async deleteFile(fileName: string): Promise<void> {
    const bucketName = this.config.storage.s3?.bucket;
    if (!bucketName) {
      throw new Error('S3 bucket name is not configured');
    }

    try {
      const key = generateObjectKey(fileName, this.config.storage.s3?.prefix || '');
      
      // Delete object from S3
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to delete backup from S3: ${err.message}`);
    }
  }

  /**
   * Check if a file exists in S3
   * @param fileName Name of the file to check
   * @returns True if the file exists, false otherwise
   */
  public async fileExists(fileName: string): Promise<boolean> {
    const bucketName = this.config.storage.s3?.bucket;
    if (!bucketName) {
      throw new Error('S3 bucket name is not configured');
    }

    try {
      const key = generateObjectKey(fileName, this.config.storage.s3?.prefix || '');
      
      // Check if object exists in S3
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );
      
      return true;
    } catch (error) {
      // Object doesn't exist or other error
      return false;
    }
  }
}
