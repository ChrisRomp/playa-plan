/**
 * Utility functions for storage providers
 */

/**
 * Generate a storage object key with proper prefix handling
 * This is used by S3, GCS, and Azure storage providers to construct
 * consistent object keys when storing and retrieving backup files
 * 
 * @param fileName The base file name for the backup
 * @param prefix Optional path prefix to prepend to the file name
 * @returns Formatted object key with properly formatted prefix
 */
export function generateObjectKey(fileName: string, prefix?: string): string {
  if (!prefix) return fileName;
  
  // Ensure the prefix has a trailing slash if it doesn't already
  return `${prefix}${prefix.endsWith('/') ? '' : '/'}${fileName}`;
}

/**
 * Infer backup type from file name
 * @param fileName Name of the backup file
 * @returns Type of backup (full, schema, or wal)
 */
export function getBackupTypeFromFileName(fileName: string): 'full' | 'schema' | 'wal' {
  if (fileName.includes('_full_')) return 'full';
  if (fileName.includes('_schema_')) return 'schema';
  return 'wal';
} 