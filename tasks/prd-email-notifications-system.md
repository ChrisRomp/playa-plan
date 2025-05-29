# Email Notifications System - Product Requirements Document

## Introduction/Overview

The PlayaPlan application currently has a partially implemented email notifications system with conflicting configuration approaches. This feature will consolidate email configuration to use the database-driven approach (via CoreConfig) instead of environment variables, ensure reliable delivery of critical user notifications, and implement proper audit trailing for sent emails.

**Problem**: Users need to receive email notifications for authentication, registration events, and profile changes. Currently, the system has mixed configuration sources and incomplete notification coverage.

**Goal**: Implement a unified, database-configured email notification system that handles all required user communications and maintains a complete audit trail.

## Goals

1. **Consolidate Configuration**: Remove environment-based email configuration and use only the database-stored CoreConfig approach
2. **Complete Notification Coverage**: Ensure all specified notification types are implemented and properly triggered
3. **Audit Trail**: Track all sent emails for compliance and debugging purposes
4. **Reliability**: Provide clear error handling and logging for failed email deliveries
5. **Admin Control**: Allow administrators to configure email settings through the existing UI

## User Stories

- **As a new user**, I want to receive email verification codes so that I can authenticate and access the system
- **As a user changing my email**, I want to receive confirmation emails at both old and new addresses so that I know the change was successful and authorized
- **As a user completing registration**, I want to receive a confirmation email so that I have a record of my registration and payment status
- **As an administrator**, I want to configure email settings through the web interface so that I don't need server access to manage email delivery
- **As an administrator**, I want to see a history of sent emails so that I can troubleshoot delivery issues and maintain compliance records

## Functional Requirements

### 1. Configuration Migration
1.1. Remove all email-related configuration from `apps/api/src/config/configuration.ts`
1.2. Update EmailService to read configuration from CoreConfig database table instead of environment variables
1.3. Ensure SMTP configuration fields in CoreConfig are used: `smtpHost`, `smtpPort`, `smtpUser`, `smtpPassword`, `smtpSecure`, `senderEmail`, `senderName`
1.4. Remove email provider selection logic - use SMTP only
1.5. Update service initialization to fetch configuration from database on startup and when configuration changes
1.6. Add global email toggle field `emailEnabled` (boolean, default false) to CoreConfig to allow admins to disable email sending while preserving configuration

### 2. Email Notification Types
2.1. **Email Authentication (Login Codes)**
   - Send verification code when user requests login
   - Include clear instructions and code expiration time
   - Template includes: recipient name, verification code, expiration time

2.2. **Email Change Notifications**
   - Send confirmation to old email address when email change is initiated
   - Send confirmation to new email address when email change is completed
   - Include security messaging about the change
   - Template includes: user name, old email, new email, timestamp

2.3. **Registration Confirmation**
   - Send confirmation when user completes registration
   - Include registration details and payment status
   - Template includes: user name, camping options selected, work shifts, dues amount, payment status

2.4. **Registration Error Notification**
   - Send notification when registration fails (e.g., payment failure)
   - Include next steps for completion
   - Template includes: user name, error details, instructions for resolution

### 3. Email Audit Trail
3.1. Create new database table `email_audit` with fields:
   - `id`: UUID primary key
   - `recipientEmail`: Semicolon-delimited list of TO recipients
   - `ccEmails`: Semicolon-delimited list of CC recipients (optional)
   - `bccEmails`: Semicolon-delimited list of BCC recipients (optional)
   - `subject`: Email subject line
   - `notificationType`: Enum matching notification types
   - `status`: Enum (SENT, FAILED)
   - `errorMessage`: Text field for failure details (optional)
   - `sentAt`: Timestamp when email was sent (UTC)
   - `userId`: Reference to user if applicable (optional)
   - `createdAt`: Record creation timestamp (UTC)

3.2. Log every email attempt (both successful and failed) to this table
3.3. Do NOT store email body content for privacy/security reasons
3.4. When global email toggle is disabled, still log email attempts with status indicating emails were not sent due to disabled configuration

### 4. Service Integration
4.1. Update AuthService to trigger email notifications for login codes
4.2. Update user profile service to trigger email change notifications
4.3. Update registration service to trigger confirmation/error notifications
4.4. Ensure all notification calls are non-blocking (don't fail the main operation if email fails)
4.5. Respect global `emailEnabled` toggle - when disabled, log email attempts but do not send actual emails
4.6. All email notifications must be triggered internally by backend services only - no direct email sending APIs exposed to frontend (except existing admin-only endpoints)

### 5. Error Handling
5.1. Log all email failures with detailed error messages
5.2. Continue application operation even if email sending fails
5.3. Record failed attempts in audit trail with error details
5.4. Provide clear console output in development mode for debugging

## Non-Goals (Out of Scope)

1. **Retry Logic**: Failed emails will be logged but not automatically retried
2. **User Notification Preferences**: All notifications are mandatory
3. **Admin Notifications**: No notifications for administrative events (e.g., camping options full)
4. **Multiple Email Providers**: Only SMTP support, no SendGrid/other providers
5. **Email Template Editor**: Templates remain hardcoded in the service
6. **Bulk Email Functionality**: Individual transactional emails only

## Design Considerations

1. **Email Templates**: Use existing hardcoded template approach in NotificationsService `apps/api/dist/src/notifications/services/notifications.service.js` - this can be refactored if helpful
2. **Database Schema**: Extend existing notification infrastructure, add new audit table
3. **Configuration UI**: Leverage existing AdminConfigPage.tsx SMTP configuration section, add global email enable/disable toggle
4. **Service Architecture**: Build on existing EmailService and NotificationsService

## Technical Considerations

1. **Database Migration**: Create migration for new `email_audit` table
2. **Service Initialization**: EmailService must handle dynamic configuration loading from database
3. **Configuration Caching**: Consider caching CoreConfig to avoid database queries on every email (this is not a high taffic system)
4. **Testing**: Maintain development mode console output for testing without SMTP configuration
5. **Security**: Ensure SMTP credentials are handled securely, exclude from API responses, and prevent frontend abuse by keeping all email triggers internal to backend services

## Success Metrics

1. **Configuration Consolidation**: Zero email-related environment variables remain in use
2. **Notification Coverage**: 100% of specified notification types are implemented and tested
3. **Audit Compliance**: All email attempts (successful and failed) are recorded in audit table
4. **Reliability**: Email configuration can be updated through admin UI without server restart
5. **Error Handling**: Email failures do not prevent core application functionality

## Open Questions

1. Should there be a maximum retry count for database configuration fetching if the database is temporarily unavailable?
2. Do we need rate limiting for email sending to prevent abuse?
3. Should the audit table have data retention policies (e.g., delete records older than X months)?
4. Do we need email sending queues for high-volume scenarios, or is synchronous sending sufficient? 