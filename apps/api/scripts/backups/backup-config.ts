/**
 * Database Backup Configuration
 * 
 * This file contains configuration settings for database backups including
 * retention policies, storage providers, and backup schedules.
 */

export interface BackupConfig {
  // PostgreSQL database connection information
  database: {
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
    schema?: string;
  };
  
  // Backup storage settings
  storage: {
    // Primary storage provider (s3, gcs, azure, local)
    provider: 'local' | 's3' | 'gcs' | 'azure';
    
    // Retention policy
    retention: {
      // Number of daily backups to keep
      daily: number;
      // Number of weekly backups to keep
      weekly: number;
      // Number of monthly backups to keep
      monthly: number;
      // Number of yearly backups to keep
      yearly: number;
    };
    
    // Compression settings
    compression: {
      enabled: boolean;
      // Compression level (1-9)
      level: number;
    };
    
    // Local storage settings (if provider is 'local')
    local?: {
      path: string;
    };
    
    // S3 storage settings (if provider is 's3')
    s3?: {
      region: string;
      bucket: string;
      prefix: string;
      accessKeyId: string;
      secretAccessKey: string;
      endpoint?: string; // For compatibility with S3-compatible services
    };
    
    // Google Cloud Storage settings (if provider is 'gcs')
    gcs?: {
      bucket: string;
      prefix: string;
      keyFilePath?: string;
    };
    
    // Azure Blob Storage settings (if provider is 'azure')
    azure?: {
      connectionString: string;
      containerName: string;
      prefix: string;
    };
  };
  
  // Backup schedule (cron expressions)
  schedule: {
    daily: string;
    weekly: string;
    monthly: string;
    yearly: string;
  };
  
  // WAL archiving settings for point-in-time recovery
  walArchiving: {
    enabled: boolean;
    directory: string;
    // WAL segment retention period in days
    retention: number;
  };
  
  // Notification settings for backup status
  notifications: {
    enabled: boolean;
    // Email addresses to notify on backup success/failure
    emails?: string[];
    // Slack webhook URL for notifications
    slackWebhookUrl?: string;
  };
}

/**
 * Default backup configuration
 * These values can be overridden by environment variables or config files
 */
const defaultConfig: BackupConfig = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'playaplan',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    schema: process.env.DB_SCHEMA || 'public',
  },
  storage: {
    provider: (process.env.BACKUP_STORAGE_PROVIDER as 'local' | 's3' | 'gcs' | 'azure') || 'local',
    retention: {
      daily: parseInt(process.env.BACKUP_RETENTION_DAILY || '7', 10),
      weekly: parseInt(process.env.BACKUP_RETENTION_WEEKLY || '4', 10),
      monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY || '12', 10),
      yearly: parseInt(process.env.BACKUP_RETENTION_YEARLY || '2', 10),
    },
    compression: {
      enabled: process.env.BACKUP_COMPRESSION_ENABLED !== 'false',
      level: parseInt(process.env.BACKUP_COMPRESSION_LEVEL || '6', 10),
    },
    local: {
      path: process.env.BACKUP_LOCAL_PATH || './backups',
    },
    s3: {
      region: process.env.BACKUP_S3_REGION || 'us-east-1',
      bucket: process.env.BACKUP_S3_BUCKET || 'playaplan-backups',
      prefix: process.env.BACKUP_S3_PREFIX || 'database/',
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY || '',
      endpoint: process.env.BACKUP_S3_ENDPOINT || undefined,
    },
    gcs: {
      bucket: process.env.BACKUP_GCS_BUCKET || 'playaplan-backups',
      prefix: process.env.BACKUP_GCS_PREFIX || 'database/',
      keyFilePath: process.env.BACKUP_GCS_KEY_FILE_PATH || undefined,
    },
    azure: {
      connectionString: process.env.BACKUP_AZURE_CONNECTION_STRING || '',
      containerName: process.env.BACKUP_AZURE_CONTAINER_NAME || 'playaplan-backups',
      prefix: process.env.BACKUP_AZURE_PREFIX || 'database/',
    },
  },
  schedule: {
    daily: process.env.BACKUP_SCHEDULE_DAILY || '0 1 * * *', // 1:00 AM every day
    weekly: process.env.BACKUP_SCHEDULE_WEEKLY || '0 2 * * 0', // 2:00 AM every Sunday
    monthly: process.env.BACKUP_SCHEDULE_MONTHLY || '0 3 1 * *', // 3:00 AM on the 1st of every month
    yearly: process.env.BACKUP_SCHEDULE_YEARLY || '0 4 1 1 *', // 4:00 AM on January 1st
  },
  walArchiving: {
    enabled: process.env.BACKUP_WAL_ARCHIVING_ENABLED === 'true',
    directory: process.env.BACKUP_WAL_DIRECTORY || './wal_archive',
    retention: parseInt(process.env.BACKUP_WAL_RETENTION || '7', 10),
  },
  notifications: {
    enabled: process.env.BACKUP_NOTIFICATIONS_ENABLED === 'true',
    emails: process.env.BACKUP_NOTIFICATION_EMAILS 
      ? process.env.BACKUP_NOTIFICATION_EMAILS.split(',') 
      : undefined,
    slackWebhookUrl: process.env.BACKUP_NOTIFICATION_SLACK_WEBHOOK_URL || undefined,
  },
};

export default defaultConfig;
