import * as fs from 'fs';
import * as path from 'path';
import { 
  S3Client, 
  PutObjectCommand, 
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3ClientConfig
} from '@aws-sdk/client-s3';
import { BackupConfig } from '../backup-config';
import { StorageProvider, BackupFileMetadata } from '../storage-provider.interface';
import { BackupResult } from '../backup-service';

/**
 * AWS S3 Storage provider for database backups
 */
export class S3StorageProvider implements StorageProvider {
  private s3Client: S3Client;
  
  /**
   * Creates a new AWS S3 Storage provider
   * @param config Backup configuration
   */
  constructor(private readonly config: BackupConfig) {
    if (!config.storage.s3) {
      throw new Error('S3 storage configuration is required');
    }
    
    const { region, accessKeyId, secretAccessKey, endpoint } = config.storage.s3;
    
    const clientConfig: S3ClientConfig = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };
    
    // Add custom endpoint if specified (for S3-compatible services)
    if (endpoint) {
      clientConfig.endpoint = endpoint;
    }
    
    this.s3Client = new S3Client(clientConfig);
  }
  
  /**
   * Upload a backup file to S3
   * @param backupResult Result of a backup operation
   * @returns Promise that resolves with the updated backup result
   */
  public async uploadFile(backupResult: BackupResult): Promise<BackupResult> {
    try {
      const { fileName, filePath } = backupResult;
      const key = this.getObjectKey(fileName);
      
      // Read file content
      const fileContent = fs.readFileSync(filePath);
      
      // Upload file to S3
      const putCommand = new PutObjectCommand({
        Bucket: this.config.storage.s3?.bucket,
        Key: key,
        Body: fileContent,
        ContentType: 'application/octet-stream',
        Metadata: {
          'backup-type': backupResult.backupType,
          'timestamp': backupResult.timestamp.toISOString(),
        },
      });
      
      await this.s3Client.send(putCommand);
      
      return {
        ...backupResult,
        success: true,
        message: `Successfully uploaded ${fileName} to S3: ${this.config.storage.s3?.bucket}/${key}`,
      };
    } catch (error) {
      return {
        ...backupResult,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        message: `Failed to upload ${backupResult.fileName} to S3: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * List all backup files in S3
   * @returns Promise that resolves with a list of backup file metadata
   */
  public async listFiles(): Promise<BackupFileMetadata[]> {
    try {
      const files: BackupFileMetadata[] = [];
      const prefix = this.config.storage.s3?.prefix || '';
      
      // List all objects in the bucket with the specified prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: this.config.storage.s3?.bucket,
        Prefix: prefix,
      });
      
      const response = await this.s3Client.send(listCommand);
      
      if (response.Contents) {
        for (const object of response.Contents) {
          if (!object.Key) continue;
          
          // Extract backup type from the filename
          const backupType = this.getBackupTypeFromFileName(object.Key);
          
          files.push({
            fileName: path.basename(object.Key),
            filePath: object.Key,
            fileSize: object.Size || 0,
            lastModified: object.LastModified || new Date(),
            backupType,
          });
        }
      }
      
      return files;
    } catch (error) {
      console.error('Failed to list files from S3:', error);
      throw error;
    }
  }
  
  /**
   * Delete a backup file from S3
   * @param fileName Name of the file to delete
   * @returns Promise that resolves when deletion is complete
   */
  public async deleteFile(fileName: string): Promise<void> {
    try {
      const key = this.getObjectKey(fileName);
      
      // Delete the object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.config.storage.s3?.bucket,
        Key: key,
      });
      
      await this.s3Client.send(deleteCommand);
      
      console.log(`Successfully deleted ${fileName} from S3`);
    } catch (error) {
      console.error(`Failed to delete ${fileName} from S3:`, error);
      throw error;
    }
  }
  
  /**
   * Check if a backup file exists in S3
   * @param fileName Name of the file to check
   * @returns Promise that resolves with true if the file exists
   */
  public async fileExists(fileName: string): Promise<boolean> {
    try {
      const key = this.getObjectKey(fileName);
      
      // Check if the object exists
      const headCommand = new HeadObjectCommand({
        Bucket: this.config.storage.s3?.bucket,
        Key: key,
      });
      
      await this.s3Client.send(headCommand);
      return true;
    } catch (error) {
      // Object doesn't exist or error occurred
      return false;
    }
  }
  
  /**
   * Generate the full S3 object key for a file
   * @param fileName Name of the file
   * @returns Full S3 object key
   */
  private getObjectKey(fileName: string): string {
    const prefix = this.config.storage.s3?.prefix || '';
    return prefix ? `${prefix}${prefix.endsWith('/') ? '' : '/'}${fileName}` : fileName;
  }
  
  /**
   * Infer backup type from file name
   * @param fileName Name of the backup file
   * @returns Type of backup (full, schema, or wal)
   */
  private getBackupTypeFromFileName(fileName: string): 'full' | 'schema' | 'wal' {
    if (fileName.includes('_full_')) return 'full';
    if (fileName.includes('_schema_')) return 'schema';
    return 'wal';
  }
}
