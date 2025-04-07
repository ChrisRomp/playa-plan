import * as fs from 'fs';
import * as path from 'path';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { BackupConfig } from '../backup-config';
import { StorageProvider, BackupFileMetadata } from '../storage-provider.interface';
import { BackupResult } from '../backup-service';
import { generateObjectKey, getBackupTypeFromFileName } from '../utils/storage-utils';

/**
 * Azure Blob Storage provider for database backups
 */
export class AzureStorageProvider implements StorageProvider {
  private containerClient: ContainerClient;
  
  /**
   * Creates a new Azure Blob Storage provider
   * @param config Backup configuration
   */
  constructor(private readonly config: BackupConfig) {
    if (!config.storage.azure) {
      throw new Error('Azure storage configuration is required');
    }
    
    const { connectionString, containerName } = config.storage.azure;
    
    if (!connectionString) {
      throw new Error('Azure connection string is required');
    }
    
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = blobServiceClient.getContainerClient(containerName);
  }
  
  /**
   * Upload a backup file to Azure Blob Storage
   * @param backupResult Result of a backup operation
   * @returns Promise that resolves with the updated backup result
   */
  public async uploadFile(backupResult: BackupResult): Promise<BackupResult> {
    try {
      // Ensure container exists
      await this.ensureContainer();
      
      const { fileName, filePath } = backupResult;
      const blobName = this.getBlobName(fileName);
      
      // Create blob client for upload
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      
      // Upload file to Azure Blob Storage
      const fileStream = fs.createReadStream(filePath);
      const uploadResponse = await blockBlobClient.uploadStream(fileStream, undefined, undefined, {
        blobHTTPHeaders: {
          blobContentType: 'application/octet-stream',
        },
        metadata: {
          backupType: backupResult.backupType,
          timestamp: backupResult.timestamp.toISOString(),
        },
      });
      
      return {
        ...backupResult,
        success: true,
        message: `Successfully uploaded ${fileName} to Azure Blob Storage: ${this.config.storage.azure?.containerName}/${blobName}`,
      };
    } catch (error) {
      return {
        ...backupResult,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        message: `Failed to upload ${backupResult.fileName} to Azure Blob Storage: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * List all backup files in Azure Blob Storage
   * @returns Promise that resolves with a list of backup file metadata
   */
  public async listFiles(): Promise<BackupFileMetadata[]> {
    try {
      // Ensure container exists
      await this.ensureContainer();
      
      const files: BackupFileMetadata[] = [];
      const prefix = this.config.storage.azure?.prefix || '';
      
      // List all blobs in the container with the specified prefix
      const listBlobsOptions = {
        prefix,
      };
      
      // Get all blob items
      for await (const blob of this.containerClient.listBlobsFlat(listBlobsOptions)) {
        const blobClient = this.containerClient.getBlobClient(blob.name);
        const properties = await blobClient.getProperties();
        
        // Extract backup type from metadata or filename
        const backupType = properties.metadata?.backupType as 'full' | 'schema' | 'wal' || getBackupTypeFromFileName(blob.name);
        
        files.push({
          fileName: path.basename(blob.name),
          filePath: blob.name,
          fileSize: properties.contentLength || 0,
          lastModified: properties.lastModified || new Date(),
          backupType,
          metadata: properties.metadata,
        });
      }
      
      return files;
    } catch (error) {
      console.error('Failed to list files from Azure Blob Storage:', error);
      throw error;
    }
  }
  
  /**
   * Delete a backup file from Azure Blob Storage
   * @param fileName Name of the file to delete
   * @returns Promise that resolves when deletion is complete
   */
  public async deleteFile(fileName: string): Promise<void> {
    try {
      const blobName = this.getBlobName(fileName);
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      
      // Delete the blob
      await blockBlobClient.delete();
      
      console.log(`Successfully deleted ${fileName} from Azure Blob Storage`);
    } catch (error) {
      console.error(`Failed to delete ${fileName} from Azure Blob Storage:`, error);
      throw error;
    }
  }
  
  /**
   * Check if a backup file exists in Azure Blob Storage
   * @param fileName Name of the file to check
   * @returns Promise that resolves with true if the file exists
   */
  public async fileExists(fileName: string): Promise<boolean> {
    try {
      const blobName = this.getBlobName(fileName);
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      
      // Check if the blob exists
      return await blockBlobClient.exists();
    } catch (error) {
      console.error(`Failed to check if ${fileName} exists in Azure Blob Storage:`, error);
      return false;
    }
  }
  
  /**
   * Generate the full blob name for a file
   * @param fileName Name of the file
   * @returns Full Azure blob name
   */
  private getBlobName(fileName: string): string {
    return generateObjectKey(fileName, this.config.storage.azure?.prefix || '');
  }
  
  /**
   * Ensure the container exists, creating it if it doesn't
   * @returns Promise that resolves when the container exists
   */
  private async ensureContainer(): Promise<void> {
    try {
      // Check if container exists
      const containerExists = await this.containerClient.exists();
      
      // Create container if it doesn't exist
      if (!containerExists) {
        await this.containerClient.create();
        console.log(`Created container: ${this.config.storage.azure?.containerName}`);
      }
    } catch (error) {
      console.error('Failed to ensure container exists:', error);
      throw error;
    }
  }
}
