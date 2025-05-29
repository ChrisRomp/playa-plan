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

- [ ] 4.0 Service Integration for Notifications
  - [ ] 4.1 Update AuthService to call NotificationsService.sendLoginCodeEmail() when login codes are generated
  - [ ] 4.2 Create email change notification methods in NotificationsService (old email and new email templates)
  - [ ] 4.3 Update UserService email change flow to trigger email notifications to both old and new addresses
  - [ ] 4.4 Create registration confirmation template in NotificationsService with camping options, shifts, and payment details
  - [ ] 4.5 Create registration error notification template with error details and next steps
  - [ ] 4.6 Update registration services to trigger appropriate confirmation/error notifications
  - [ ] 4.7 Ensure all notification calls are wrapped in try-catch to prevent blocking main operations
  - [ ] 4.8 Add unit tests for new notification templates and service integrations
  - [ ] 4.9 Verify that all email triggers are internal to backend services only - no API endpoints allow frontend to directly trigger emails except admin-only test endpoints (if any)

- [ ] 5.0 Admin UI Updates for Email Toggle
  - [ ] 5.1 Add `emailEnabled` checkbox to Email Configuration section in AdminConfigPage.tsx
  - [ ] 5.2 Update form state to include emailEnabled field
  - [ ] 5.3 Update form submission to include emailEnabled in API payload
  - [ ] 5.4 Add visual indicators when email is disabled (grayed out SMTP fields or warning message)
  - [ ] 5.5 Update form validation to handle emailEnabled toggle appropriately
  - [ ] 5.6 Test admin UI changes to ensure toggle works correctly with existing SMTP configuration 