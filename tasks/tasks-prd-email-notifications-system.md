# Email Notifications System - Implementation Tasks

Based on: `prd-email-notifications-system.md`

## Relevant Files

- `apps/api/prisma/schema.prisma` - Add email_audit table and emailEnabled field to CoreConfig (emailEnabled field added, EmailAudit model created, NotificationType enum updated)
- `apps/api/prisma/migrations/20250529190906_add_email_audit_and_toggle/` - Database migration for schema changes (created and applied)
- `apps/api/src/config/configuration.ts` - Remove email-related environment configuration (email section removed)
- `apps/api/src/notifications/services/email.service.ts` - Update to use database configuration and add audit trail
- `apps/api/src/notifications/services/notifications.service.ts` - Enhanced notification templates and audit logging
- `apps/api/src/core-config/services/core-config.service.ts` - Service for retrieving email configuration from database
- `apps/api/src/auth/services/auth.service.ts` - Integrate email notifications for login codes
- `apps/api/src/users/services/users.service.ts` - Integrate email change notifications
- `apps/api/src/registrations/` - Services for registration confirmation/error notifications
- `apps/web/src/pages/AdminConfigPage.tsx` - Add global email toggle to admin UI
- `apps/api/src/notifications/services/email.service.spec.ts` - Unit tests for EmailService
- `apps/api/src/notifications/services/notifications.service.spec.ts` - Unit tests for NotificationsService
- `apps/api/test/` - Integration tests for notification endpoints

### Notes

- Database migration should be created using Prisma CLI: `npx prisma migrate dev --name add-email-audit-and-toggle`
- Run tests using workspace scripts: `npm run test:api` for API tests, `npm run test:web` for web tests, or `npm run test` for all tests
- Use `npm run test:watch` for watch mode during development
- Use `npm run test:coverage` to generate test coverage reports
- Test email functionality in development mode should output to console when SMTP is not configured
- **Security**: All email notifications must be triggered internally by backend services only - no direct email sending from frontend to prevent abuse

## Tasks

- [x] 1.0 Database Schema Updates
  - [x] 1.1 Add `emailEnabled` boolean field (default false) to CoreConfig model in `schema.prisma`
  - [x] 1.2 Create EmailAudit model with fields: id (UUID), recipientEmail, ccEmails, bccEmails, subject, notificationType, status, errorMessage, sentAt (UTC), userId, createdAt (UTC)
  - [x] 1.3 Add EmailAuditStatus enum with values: SENT, FAILED, DISABLED
  - [x] 1.4 Update NotificationType enum to include: EMAIL_AUTHENTICATION, EMAIL_CHANGE, REGISTRATION_CONFIRMATION, REGISTRATION_ERROR
  - [x] 1.5 Create and run database migration: `npx prisma migrate dev --name add-email-audit-and-toggle`
  - [x] 1.6 Generate updated Prisma client: `npx prisma generate`

- [x] 2.0 Configuration Migration and Service Updates
  - [x] 2.1 Remove email section from `apps/api/src/config/configuration.ts` (provider, defaultFrom, sendgrid, smtp config)
  - [x] 2.2 Update EmailService constructor to inject CoreConfigService instead of ConfigService
  - [x] 2.3 Create method in CoreConfigService to retrieve current email configuration from database
  - [x] 2.4 Add configuration caching mechanism in EmailService to avoid database queries on every email
  - [x] 2.5 Update EmailService initialization to fetch SMTP config from database on startup
  - [x] 2.6 Remove SendGrid provider logic - keep only SMTP implementation

- [x] 3.0 Email Service Enhancement with Audit Trail
  - [x] 3.1 Create EmailAuditService to handle audit trail logging
  - [x] 3.2 Update EmailService.sendEmail() to log all attempts to email_audit table
  - [x] 3.3 Add logic to respect global `emailEnabled` toggle - log but don't send when disabled
  - [x] 3.4 Enhance error handling to capture detailed error messages in audit trail
  - [x] 3.5 Update development mode console output to show when emails are disabled
  - [x] 3.6 Ensure audit logging works for both successful and failed email attempts

- [x] 4.0 Service Integration for Notifications
  - [x] 4.1 Update AuthService to call NotificationsService.sendLoginCodeEmail() when login codes are generated
  - [x] 4.2 Create email change notification methods in NotificationsService (old email and new email templates)
  - [x] 4.3 Update UserService email change flow to trigger email notifications to both old and new addresses
  - [x] 4.4 Create registration confirmation template in NotificationsService with camping options, shifts, and payment details
  - [x] 4.5 Create registration error notification template with error details and next steps
  - [x] 4.6 Update registration services to trigger appropriate confirmation/error notifications
  - [x] 4.7 Ensure all notification calls are wrapped in try-catch to prevent blocking main operations
  - [x] 4.8 Add unit tests for new notification templates and service integrations
  - [x] 4.9 Verify that all email triggers are internal to backend services only - no API endpoints allow frontend to directly trigger emails except admin-only test endpoints (if any)

- [x] 5.0 Unit Testing and Quality Assurance
  - [x] 5.1 EmailAuditService Unit Tests (uses mocked PrismaService)
    - [x] 5.1.1 Test logEmailAttempt() with all audit data fields
    - [x] 5.1.2 Test logEmailSent() creates SENT audit record with sentAt timestamp
    - [x] 5.1.3 Test logEmailFailed() creates FAILED audit record with error message
    - [x] 5.1.4 Test logEmailDisabled() creates DISABLED audit record
    - [x] 5.1.5 Test getEmailStatistics() returns correct counts and breakdown by notification type
    - [x] 5.1.6 Test audit logging handles database errors gracefully (doesn't throw)
    - [x] 5.1.7 Test CC/BCC email arrays are properly serialized as comma-separated strings
  - [x] 5.2 EmailService Unit Tests (uses mocked CoreConfigService and EmailAuditService)
    - [x] 5.2.1 Test sendEmail() successfully sends email and logs SENT audit record
    - [x] 5.2.2 Test sendEmail() logs FAILED audit record on SMTP error
    - [x] 5.2.3 Test sendEmail() logs DISABLED audit record when emailEnabled=false
    - [x] 5.2.4 Test sendEmail() handles incomplete SMTP configuration (missing fields)
    - [x] 5.2.5 Test refreshConfiguration() updates SMTP transport with database config
    - [x] 5.2.6 Test configuration caching behavior (5-minute cache)
    - [x] 5.2.7 Test OnModuleInit lifecycle hook initializes SMTP config from database
    - [x] 5.2.8 Test email validation and required fields (notificationType required)
  - [x] 5.3 CoreConfigService Unit Tests (uses mocked PrismaService)
    - [x] 5.3.1 Test getEmailConfiguration() returns all email config fields from database
    - [x] 5.3.2 Test getEmailConfiguration() returns safe defaults on database error
    - [x] 5.3.3 Test getEmailConfiguration() handles missing configuration gracefully
    - [x] 5.3.4 Test email configuration field mapping between entity and database
  - [x] 5.4 NotificationsService Unit Tests (uses mocked EmailService - completed)
    - [x] 5.4.1 Test sendLoginCodeEmail() template and audit logging
    - [x] 5.4.2 Test sendEmailChangeNotification() to old and new email addresses
    - [x] 5.4.3 Test sendRegistrationConfirmation() with camping options and payment details
    - [x] 5.4.4 Test sendRegistrationError() with error details and next steps
    - [x] 5.4.5 Test all notification methods handle EmailService failures gracefully
    - [x] 5.4.6 Test template generation includes all required dynamic content
  - [x] 5.5 Service Integration Unit Tests (uses mocked NotificationsService - completed)
    - [x] 5.5.1 Test AuthService login code generation triggers email notification
    - [x] 5.5.2 Test UserService email change triggers notifications to both addresses
    - [x] 5.5.3 Test registration services trigger appropriate confirmation/error emails
    - [x] 5.5.4 Test all service integrations handle notification failures without blocking main operations
    - [x] 5.5.5 Test notification calls include correct user context and notification types
  - [x] 5.6 Integration Tests (uses test database + mock SMTP server like Ethereal Email or Docker mailhog)
    - [x] 5.6.1 Test complete email flow from service call to audit log creation
    - [x] 5.6.2 Test email configuration changes are reflected in email sending
    - [x] 5.6.3 Test global email toggle affects all notification types
    - [x] 5.6.4 Test email audit statistics endpoint returns accurate data
    - [x] 5.6.5 Test SMTP configuration validation and connection testing (uses nodemailer test account)
    - [x] 5.6.6 Test concurrent email sending with cache coherency
  - [x] 5.7 Error Handling and Edge Cases (uses mocks to simulate error conditions)
    - [x] 5.7.1 Test database connection failures during email operations
    - [x] 5.7.2 Test malformed email addresses and content validation
    - [x] 5.7.3 Test SMTP timeout and connection failure scenarios
    - [x] 5.7.4 Test large attachment handling and size limits
    - [x] 5.7.5 Test email queue backpressure and rate limiting scenarios
    - [x] 5.7.6 Test configuration cache invalidation on service restart

- [x] 6.0 Admin UI Updates for Email Toggle
  - [x] 6.1 Add `emailEnabled` checkbox to Email Configuration section in AdminConfigPage.tsx
  - [x] 6.2 Update form state to include emailEnabled field
  - [x] 6.3 Update form submission to include emailEnabled in API payload
  - [x] 6.4 Add visual indicators when email is disabled (grayed out SMTP fields or warning message)
  - [x] 6.5 Update form validation to handle emailEnabled toggle appropriately
  - [x] 6.6 Test admin UI changes to ensure toggle works correctly with existing SMTP configuration

- [x] 6.7 Admin Test Email Feature
  - [x] 6.7.1 Enhanced Test Email Service
    - [x] 6.7.1.1 Update sendTestEmail method to use dedicated test email template instead of email verification
    - [x] 6.7.1.2 Include SMTP configuration details in test email content (host, port, secure status)
    - [x] 6.7.1.3 Add timestamp and admin user info to test email
    - [x] 6.7.1.4 Return detailed response including email audit record ID for tracking
  - [x] 6.7.2 Create test email UI component in admin panel
    - [x] 6.7.2.1 Add "Test Email Configuration" section to Email Configuration page
    - [x] 6.7.2.2 Create email input field with validation (must be valid email format)
    - [x] 6.7.2.3 Add "Send Test Email" button with loading state
    - [x] 6.7.2.4 Display success/failure status with detailed feedback messages
    - [x] 6.7.2.5 Show email audit record link for successful test emails
  - [ ] 6.7.3 Enhance test email functionality
    - [ ] 6.7.3.1 Add ability to test with custom subject and message content
    - [ ] 6.7.3.2 Include option to send test email to multiple recipients
    - [ ] 6.7.3.3 Show preview of email content before sending
    - [ ] 6.7.3.4 Add quick-select buttons for common test scenarios (HTML vs plain text)
  - [ ] 6.7.4 Test email monitoring and troubleshooting
    - [ ] 6.7.4.1 Display recent test email history in admin panel
    - [ ] 6.7.4.2 Add "Test SMTP Connection" button that validates configuration without sending email
    - [ ] 6.7.4.3 Show detailed error messages for SMTP connection failures
    - [ ] 6.7.4.4 Add tooltips explaining common email configuration issues
  - [ ] 6.7.5 Unit and integration tests for test email feature
    - [ ] 6.7.5.1 Test enhanced backend test email endpoint
    - [ ] 6.7.5.2 Test admin UI test email component rendering and interactions
    - [ ] 6.7.5.3 Test email validation and error handling in UI
    - [ ] 6.7.5.4 Test integration between frontend and backend for test emails
    - [ ] 6.7.5.5 Test SMTP connection validation functionality 