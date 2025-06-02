# Product Requirements Document: Admin Registration Management

## Introduction/Overview

This feature will provide administrators with the ability to edit and cancel user registrations within the Playa Plan system. The feature addresses common administrative needs including handling user cancellation requests, correcting data issues, resolving scheduling conflicts, and managing registrations for unapproved users.

The goal is to give administrators comprehensive control over registration management while maintaining data integrity, audit trails, and appropriate user notifications.

## Goals

1. Enable administrators to modify registration details and dependent records
2. Provide a streamlined cancellation process with automatic cleanup of related records
3. Implement a comprehensive audit trail for all administrative actions
4. Ensure optional appropriate user notifications when registrations are modified or cancelled
5. Maintain data integrity across all related systems (payments, shifts, camping options)

## User Stories

**Registration Editing:**
- As an admin, I want to modify a user's work shift assignments so that I can resolve scheduling conflicts
- As an admin, I want to change a user's camping options so that I can accommodate special requests or correct errors
- As an admin, I want to edit registration details so that I can fix data entry mistakes

**Registration Cancellation:**
- As an admin, I want to cancel a registration at a user's request so that they can receive appropriate refunds and their spots can be released to others
- As an admin, I want to cancel registrations for unapproved users so that spots are available for legitimate registrants
- As an admin, I want to process refunds during cancellation so that users receive appropriate compensation

**Audit and Communication:**
- As an admin, I want to see a history of all changes made to registrations so that I can track modifications and resolve disputes
- As an admin, I want to optionally notify users of changes so that they stay informed about their registration status

## Functional Requirements

### Registration Editing
1. The system must allow admins to access a registration edit interface for any active registration
2. The system must allow editing of registration-specific fields and dependent records (camping options, work shifts)
3. The system must prevent editing of already cancelled registrations
4. The system must allow editing of registrations regardless of payment status
5. The system must not allow direct modification of payment amounts or status (except for refund processing)

### Registration Cancellation
6. The system must allow admins to cancel any active registration
7. The system must prompt admins to process a refund when cancelling registrations with associated payments
8. The system must automatically delete associated work shifts when a registration is cancelled
9. The system must release camping options (make them not count toward total allocation) when a registration is cancelled
10. The system must update the registration status to "cancelled" upon cancellation

### Audit Trail
11. The system must create audit records for all administrative actions on registrations
12. The audit table must be designed as a general-purpose audit system for future administrative actions
13. The audit records must include: timestamp, admin user ID, action type, target record ID, old values, new values, and reason/notes (using IDs for user identification to avoid PII)
14. The audit trail must be viewable by administrators via admin section

### User Notifications
15. The system must include a notification toggle (checkbox) on all modification and cancellation forms
16. The notification toggle must be unchecked (disabled) by default
17. The system must send notifications to registrants when their registration is modified or cancelled (if toggle is enabled)
18. Notifications must show the user's current registration status: for modifications, use the same format as registration confirmation with a note that the registration was modified; for cancellations, send a simple notification that the registration has been cancelled

### User Interface
19. The system must provide an intuitive interface for finding and selecting registrations to edit/cancel
20. The system must display current registration details clearly before allowing modifications
21. The system must provide confirmation dialogs for cancellation actions
22. The system must display success/error messages for all administrative actions

## Non-Goals (Out of Scope)

1. Editing user profile information (separate interface already exists)
2. Direct modification of payment amounts or creating new charges
3. Bulk editing or cancellation of multiple registrations simultaneously
4. Different permission levels for different types of administrative actions
5. Time-based restrictions on when registrations can be modified
6. Automatic refund processing (admin must manually approve refunds)
7. Meal plan management (not part of current system)

## Design Considerations

### Navigation
- Create new "Manage Registrations" section in admin panel (separate from existing Registration Reports)
- Provide search/filter functionality to locate specific registrations
- Include quick action buttons for common operations (Edit, Cancel)
- Maintain clear separation between "view data" (reports) and "manage data" (admin actions)

### Forms
- Use consistent form patterns with existing admin interfaces
- Implement clear field validation and error messaging
- Include confirmation steps for destructive actions (cancellation)
- Provide dedicated edit/cancel forms rather than inline editing

### Data Table Integration
- Leverage existing DataTable component with action columns for Edit/Cancel buttons
- Reuse registration data fetching patterns from RegistrationReportsPage
- Implement similar filtering and search functionality as reports page
- Add administrative action columns to table display

### Notifications
- Follow existing notification patterns in the application
- Use clear, user-friendly language in notification messages
- Include admin contact information for questions

## Technical Considerations

### Database Schema
- Create general-purpose `admin_audit` table for tracking all administrative actions using Prisma schema definitions
- Ensure referential integrity when deleting/updating related records through Prisma relationships
- Consider soft deletion for audit purposes vs. hard deletion for data cleanup
- Follow existing Prisma schema patterns and naming conventions

### Data Access Layer
- Use Prisma ORM for all database operations following existing service patterns
- Leverage existing Prisma models for Registration, User, Job, CampingOption entities
- Implement audit trail using Prisma transactions to ensure atomicity
- Follow established Prisma query patterns used throughout the application

### API Design
- Follow existing RESTful patterns in the application
- Implement proper validation for all edit operations using existing DTO patterns
- Ensure atomic operations for cancellation workflow using Prisma transactions
- Use existing Prisma service injection patterns in NestJS controllers

### Integration Points
- Payment service integration for refund processing
- Notification service for user communications
- Existing user management and camping allocation systems

### Testing Requirements
- Unit tests for all service methods handling registration modifications
- Unit tests for audit trail creation and retrieval
- Unit tests for notification logic and user communication
- Integration tests for complete edit/cancel workflows
- Unit tests for camping option release logic
- Unit tests for work shift deletion on cancellation

## Success Metrics

While specific quantitative metrics were not defined, success can be measured by:
- Reduction in manual administrative overhead
- Improved data accuracy and consistency
- Faster resolution of user requests and issues
- Complete audit trail coverage for administrative actions

## Open Questions

1. Should there be any approval workflow for certain types of modifications (e.g., refunds above a certain amount)?
2. How should the system handle edge cases where camping options or shifts have complex dependencies?
3. Should administrators be able to add notes or reasons that are visible to users in notifications?
4. Use IDs to identify users in audit logs to avoid storing PII in the audit table

## Implementation Notes

- Leverage existing authentication and authorization systems
- Follow established patterns for admin interfaces in the current application
- Ensure all database operations are properly transactional using Prisma transactions
- Implement comprehensive error handling for all edge cases
- Consider performance implications of audit logging for high-volume operations
- Reuse data fetching logic and DataTable component from existing RegistrationReportsPage
- Maintain consistent styling and layout patterns with existing admin interfaces
- Implement new admin navigation section separate from reports functionality
- Follow existing Prisma ORM patterns and schema conventions used throughout the application
- Use established NestJS service patterns with Prisma client dependency injection 