/**
 * Details about the SMTP configuration and admin context for a test email.
 */
export interface TestEmailDetails {
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpSecure: boolean;
  readonly senderEmail: string;
  readonly senderName: string;
  readonly adminUserName: string;
  readonly adminEmail: string;
  readonly timestamp: Date;
}

/**
 * Optional custom content for a test email.
 */
export interface TestEmailCustomContent {
  readonly subject?: string;
  readonly message?: string;
  readonly format?: 'html' | 'text';
  readonly includeSmtpDetails?: boolean;
}

/**
 * Result returned by the service after attempting to send test emails.
 */
export interface TestEmailResult {
  readonly success: boolean;
  readonly recipients: string[];
}

/**
 * Shape of the HTTP response returned by the test-email controller endpoint.
 */
export interface TestEmailResponse {
  success: boolean;
  message: string;
  auditRecordId?: string;
  timestamp: string;
  recipients?: string[];
  smtpConfiguration?: {
    host: string;
    port: number;
    secure: boolean;
    senderEmail: string;
    senderName: string;
  };
  emailPreview?: {
    subject: string;
    format: string;
    includeSmtpDetails: boolean;
  };
}
