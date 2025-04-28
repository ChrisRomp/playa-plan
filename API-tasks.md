# API Tasks Remaining

## Priority Order for Implementation

## 1. 🏗️ Infrastructure & Configuration

- [x] Configure database migrations workflow and scripts
  - [x] Set up Prisma migration scripts for dev/test/prod environments
  - [x] Configure environment-specific database connections
  - [x] Add database setup and reset scripts
- [x] Implement environment configuration management (dev/test/prod)
  - [x] Create configuration files with environment validation
  - [x] Set up environment-specific configuration loading
  - [x] Implement configuration service with type safety
- [x] Set up CORS configuration for different environments
  - [x] Configure origins, methods, and headers
  - [x] Implement environment-specific CORS settings
- [x] Configure connection pooling for database
  - [x] Enhance PrismaService with proper error handling
  - [x] Implement database health check functionality
- [ ] Set up database backup strategy
  - [ ] Configure PostgreSQL with WAL archiving settings for point-in-time recovery
  - [ ] Create automated backup scripts using `pg_dump` for logical backups
  - [ ] Implement backup rotation and retention policies
  - [?] Set up offsite backup storage (S3/GCS/Azure Blob Storage) for backups
  - [ ] Develop database restoration procedures and documentation
  - [ ] Configure backup monitoring and alerting
  - [ ] Test restoration procedures regularly

## 2. 🛡️ Core Security & User Management

### 🔐 Authentication Module

- [x] Implement Local authentication strategy (Passport.js)
- [x] Implement JWT authentication strategy (Passport.js)
- [x] Implement authentication controller and service
- [x] Implement DTOs for login and registration
- [x] Implement email verification flow
- [x] Implement password reset flow
- [ ] Implement email code verification login
- [x] Write unit tests for authentication controller and service
- [ ] Write integration (e2e) tests for authentication endpoints

### 🛠️ Users Module

- [x] Implement `User` entity definition (`user.entity.ts`)
- [x] Implement additional DTOs (e.g., `update-user.dto.ts`)
- [x] Implement additional validation schemas as needed
- [x] Implement authorization guards for user endpoints
- [x] Fix TypeScript errors and type safety issues in User module
- [x] Implement user data serialization with class-transformer
- [x] Implement UserTransformInterceptor to exclude sensitive fields
- [ ] Implement user-specific middleware or interceptors if needed
- [x] Write unit tests for User controllers, services, and guards
- [x] Write unit tests for UserTransformInterceptor
- [ ] Complete integration (e2e) tests for all user endpoints
- [x] Add admin/test method to controller as a smoke test
- [x] Update Swagger documentation for all user endpoints
- [ ] Document user module usage and endpoints in README.md
- [x] Update User model for additional profile fields from spec
  - [x] Add emergency contact info field
  - [x] Add phone field
  - [x] Add city, state/province fields
  - [x] Add country field
  - [x] Add allow registration boolean
  - [x] Add allow early registration boolean
  - [x] Add allow deferred dues payment boolean
  - [x] Add allow no job boolean
  - [x] Add internal notes field

### 🛡️ Security Foundations

- [x] Implement global exception filters for standardized error handling
- [x] Implement rate limiting for API endpoints
- [x] Add request validation pipes and sanitization
- [x] Implement API security headers (CSRF protection, etc.)
- [x] Set up input sanitization to prevent injection attacks
- [ ] Implement Cloudflare Turnstile for bot protection on public endpoints
  - [ ] Integrate Turnstile API with authentication endpoints
  - [ ] Add server-side validation of Turnstile tokens
  - [ ] Implement fallback mechanisms for accessibility

## 3. 📚 Core Domain Modules

### 🏕️ Camp Module

- [x] Implement CRUD operations for camp sessions
- [x] Implement DTOs and validation schemas
- [x] Write unit tests for camp controllers and services
- [ ] Write integration (e2e) tests for camp endpoints
  - [ ] Create e2e test files following project patterns
  - [ ] Implement proper test data creation and cleanup
  - [ ] Test permissions (admin vs. regular users)

### 🛠️ Jobs Module

- [x] Implement CRUD operations for jobs
  - [x] Create jobs module structure
  - [x] Implement jobs controller with CRUD endpoints
  - [x] Implement jobs service with Prisma integration
  - [x] Create DTOs for job creation and updates
- [x] Implement job categories management
  - [x] Create category entity
  - [x] Implement category controller
  - [x] Implement category service
  - [x] Create DTOs for categories
- [x] Write unit tests for job controllers and services
- [x] Write integration (e2e) tests for job endpoints
- [x] Update Job model for additional fields from spec
  - [x] Add staff only boolean field
  - [x] Add always required boolean field

### 📅 Shifts Module

- [x] Implement CRUD operations for shifts within camp sessions
  - [x] Create shifts module structure
  - [x] Implement shifts controller with CRUD endpoints
  - [x] Implement shifts service with Prisma integration
  - [x] Create DTOs for shift creation and updates
- [x] Implement DTOs and validation schemas
- [x] Write unit tests for shift controllers and services
- [x] Fix integration (e2e) tests for shift endpoints
  - [x] Create e2e test files
  - [x] Fix authentication issues in the e2e tests
    - [x] Ensure test users exist in test database
    - [x] Verify JWT token generation in test environment
    - [x] Update test setup to handle authentication properly
  - [x] Update tests to handle proper test data creation and teardown
  - [x] Ensure all shift e2e tests pass
- [ ] Update Shift model to support day-of-week selection rather than specific dates

### 📝 Registrations Module

- [x] Implement CRUD operations for user registrations to shifts
- [x] Implement DTOs and validation schemas
- [x] Write unit tests for registration controllers and services
- [x] Write integration (e2e) tests for registration endpoints

### 🏕️ Camping Options Module (Missing)

- [ ] Create CampingOptions module with CRUD operations
  - [ ] Create entity, controller, and service for camping options
  - [ ] Implement relationships between users, camps, and camping options
  - [ ] Create DTOs for camping option creation and updates
  - [ ] Implement validation for camping options
- [ ] Implement camping option model with following fields
  - [ ] Name
  - [ ] Enabled boolean
  - [ ] Work shifts required count
  - [ ] Job categories relationship
  - [ ] Participant dues
  - [ ] Staff dues
  - [ ] Maximum signups
  - [ ] Additional fields configuration system
- [ ] Implement camping option fields configuration
  - [ ] Create field type enum (string, number, boolean, date)
  - [ ] Support for field validation options
  - [ ] Create controller endpoints for field management
- [ ] Write unit tests for camping options
- [ ] Write integration tests for camping options

## 4. 💪 Supporting Features

### 💳 Payments Module

- [x] Integrate Stripe payment processing
  - [x] Create Stripe service for payment intents
  - [x] Implement checkout session creation
  - [x] Add webhook handling for Stripe events
  - [x] Handle refunds through Stripe
- [x] Integrate PayPal payment processing
  - [x] Create PayPal service for order creation
  - [x] Implement payment capture functionality
  - [x] Add refund processing through PayPal
- [x] Include ability to manually record payments and refunds
  - [x] Implement manual payment recording
  - [x] Add support for recording refunds
- [x] Implement payment controller and service
  - [x] Create main PaymentsService for orchestrating payments
  - [x] Add methods for working with both payment providers
  - [x] Implement payment lifecycle management
- [x] Implement DTOs and validation schemas
  - [x] Create CreatePaymentDto for general payments
  - [x] Create specific DTOs for Stripe and PayPal payments
  - [x] Add RecordManualPaymentDto for manual transactions
  - [x] Create UpdatePaymentDto for payment status updates
  - [x] Implement CreateRefundDto for refund processing
- [x] Complete controller implementation with endpoints
  - [x] Create controller with required endpoints
  - [x] Implement payment operations endpoints
  - [x] Add webhook handlers for payment providers
  - [x] Define appropriate security and roles for each endpoint
- [x] Update app.module.ts to include PaymentsModule
- [x] Write unit tests for payment controllers and services
  - [x] Create unit tests for PaymentsService
  - [x] Create unit tests for PaymentsController
  - [x] Create unit tests for StripeService
  - [x] Create unit tests for PaypalService
  - [x] Fix failing tests in StripeService and PaypalService unit tests
- [ ] Write integration (e2e) tests for payment endpoints

### 📧 Notifications Module

- [x] Implement transactional email sending (SendGrid, SMTP)
  - [x] Create EmailService for sending emails
  - [x] Set up SendGrid integration
  - [x] Add SMTP fallback option
  - [x] Implement error handling and logging
- [x] Implement notification controller and service
  - [x] Create NotificationsService
  - [x] Create email templates for various notifications
  - [x] Implement NotificationsController with endpoints
  - [x] Secure endpoints with proper authorization
- [x] Write unit tests for notification controllers and services
  - [x] Create unit tests for EmailService
  - [x] Create unit tests for NotificationsService
  - [x] Create unit tests for NotificationsController
- [ ] Write integration (e2e) tests for notification endpoints
- [ ] When the backend server is running in debug mode, emit notifications to the console as well as any configured email services (or just console if no email service is configured)

### Advanced User Features

- [x] Implement email verification and password reset integration with Notifications module

### ⚙️ Core Configuration Module (Missing)

- [ ] Create CoreConfig module with CRUD operations
  - [ ] Create CoreConfig entity with all site configuration options
  - [ ] Implement controller and service for managing site config
  - [ ] Create DTOs for configuration updates
- [ ] Implement camp info configuration section
  - [ ] Camp name
  - [ ] Camp description
  - [ ] Home page blurb
  - [ ] Camp banner URL
  - [ ] Camp icon URL
- [ ] Implement registration configuration section
  - [ ] Registration year
  - [ ] Early registration open flag
  - [ ] Registration open flag
  - [ ] Registration terms
  - [ ] Allow deferred dues payment flag
- [ ] Implement payment processing configuration
  - [ ] Stripe enabled flag and settings
  - [ ] PayPal enabled flag and settings
- [ ] Implement email configuration section
  - [ ] SMTP configuration management
- [ ] Implement site configuration
  - [ ] Time zone setting
- [ ] Write unit tests for CoreConfig module
- [ ] Write integration tests for CoreConfig endpoints

## 5. 🔍 Operations & Monitoring

- [ ] Implement structured API logging system
- [ ] Create health check endpoints for monitoring
- [?] Set up metrics collection (optional)
- [?] Implement feature flags system (optional)
- [ ] Add performance monitoring and tracing
- [?] Create maintenance mode capability (deferred)
- [ ] Set up database indexes for performance optimization
- [ ] Implement request timeout handling

## 6. 🧪 Testing and Quality Assurance

- [ ] Complete unit tests for all controllers, services, guards, pipes, and filters
- [ ] Complete integration (e2e) tests for all API endpoints
  - [ ] Create shared e2e testing utilities and helper functions
  - [ ] Implement consistent test data seeding/cleanup for e2e tests
  - [ ] Create standardized authentication setup for all e2e tests
  - [ ] Implement test database handling (reset between test suites)
  - [ ] Add test reporting and coverage for e2e tests
- [ ] Implement shared testing utilities and mock factories
  - [ ] Create reusable entity factories for testing (users, camps, jobs, etc.)
  - [ ] Create standardized mock services for common dependencies
  - [ ] Implement helper functions for JWT token generation in tests
- [ ] Implement test data fixtures for consistent testing scenarios
  - [ ] Create sample data fixtures for each entity type
  - [ ] Implement seed/cleanup utilities for test data
  - [ ] Ensure test isolation between test suites

## 7. 📊 Reporting & Dashboards (Missing)

- [ ] Create ReportingModule for staff/admin dashboards
  - [ ] Create reporting controller and service
  - [ ] Implement authorization for reports access
- [ ] Implement Work Schedule report
  - [ ] Group work schedule by day then category
  - [ ] Include staff-only jobs visibility
  - [ ] Support filtering and sorting options
- [ ] Implement Registration Dashboard report
  - [ ] Show registrations with grouped/filtered capability
  - [ ] Support for drilling into user profile details
  - [ ] Access to payment/refund information for admins
- [ ] Create data export functionality for reports
  - [ ] CSV export capability
  - [ ] Excel export capability
- [ ] Write unit tests for reporting module
- [ ] Write integration tests for reporting endpoints

## 8. 📚 Shared Libraries and Documentation

### 📚 Shared Libraries (`libs`)

- [ ] Define shared TypeScript types/interfaces (DTOs, entities)
- [ ] Define shared constants (e.g., role enums)
- [ ] Implement shared validation schemas (Zod or class-validator)
- [ ] Implement shared utility functions (e.g., date formatting)
- [ ] Write unit tests for shared utilities and validation schemas

### 📖 Documentation and CI/CD

- [ ] Update Swagger (OpenAPI) documentation for all endpoints
- [ ] Configure GitHub Actions workflows for continuous integration and deployment
  - [ ] Implement CI for API on PRs to `main`
- [ ] Document API setup and usage instructions in README.md

## 9. 🗃️ Database Management

- [ ] Set up database seeding workflow
- [ ] Create database test fixtures for e2e tests
- [ ] Create database versioning strategy
