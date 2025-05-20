# PlayaPlan Web Frontend

## Initial Setup Tasks

1. [x] Set up base Vite React TypeScript project
2. [x] Add Tailwind CSS
3. [x] Set up project structure according to the plan
4. [x] Configure ESLint and Prettier
5. [x] Configure Vitest for unit testing
6. [ ] Create basic shared components (with typed props):
   - [x] Button (via Tailwind/Lucide integration)
   - [x] Input (via login form component)
   - [ ] Form
   - [x] Card (used in layout components)
   - [x] Modal (via UI components)
   - [ ] DataTable (with sorting/filtering/grouping)
   - [x] Notification (via UI components)
   - [x] AccessibleImage (via header/banner implementation)
   - [x] RichTextContent (sanitization in MainContent)
7. [x] Set up basic routing (using React Router)
   - [x] Install React Router (react-router-dom is available)
   - [x] Configure routes and navigation
   - [x] Implement protected routes based on authentication
   - [x] Set up role-based access control for routes
8. [x] Create auth context and login/register pages (include loading/error states)
9. [x] Set up basic API client
10. [x] Create initial home page with responsive layout
11. [ ] Implement WCAG 2.2 accessibility standards
     - [x] Implement proper focus management
     - [x] Add keyboard navigation support
     - [ ] Enhance Navigation component with proper keyboard accessibility and ARIA attributes
     - [ ] Ensure screen reader compatibility
     - [x] Configure proper ARIA attributes

## API Integration Tasks

1. [x] Update API client to use actual backend endpoints
   - [x] Set up basic API client structure with Axios
   - [x] Set up API response type validation with Zod
   - [x] Configure proper error handling
   - [x] Implement authentication token management with HTTP-only cookies

2. [x] Connect authentication flow to API
   - [x] Update AuthContext to use real API endpoints instead of mock data
   - [x] Implement proper JWT storage using HTTP-only cookies
   - [x] Handle authentication errors and edge cases
   - [x] Implement caching and debouncing for authentication API calls
   - [ ] Complete registration flow with profile data collection

3. [x] Connect core configuration to API
   - [x] Set up ConfigContext structure 
   - [x] Update ConfigContext to fetch real data from API via public endpoint
   - [x] Implement public configuration endpoint for unauthenticated access
   - [x] Handle configuration loading states
   - [x] Implement proper error handling for config fetching
   - [x] Add validation with Zod schema
   - [x] Create fallback configuration when API calls fail

4. [x] Implement routing with React Router
   - [x] Add route configuration
   - [x] Implement protected routes using authentication state
   - [x] Add role-based route permissions
   - [x] Replace window.location redirects with React Router navigation

## Feature Roadmap

1. [x] User authentication system
   - [x] Email authorization code login process connected to API
   - [x] JWT persistence using HTTP-only cookies
     - [x] Set up cookie service utility
     - [x] Configure secure but practical cookie settings (Secure, SameSite Lax)
     - [x] Implement automatic token refresh mechanism
     - [x] Handle session expiration gracefully
   - [x] Basic user registration via email verification
   - [x] Complete registration flow with profile data collection
   - [ ] CAPTCHA integration for security
     - [ ] Implement reCAPTCHA or similar for login/registration forms
     - [ ] Add server-side verification of CAPTCHA tokens
     - [ ] Handle CAPTCHA errors and accessibility concerns

2. [x] User profile management
   - [x] Complete profile form with all required fields
   - [ ] Email change process with verification
   - [x] Profile editing

3. [ ] Camp registration system
   - [ ] Registration flow with profile confirmation
   - [ ] Camping option selection with capacity indicators
   - [ ] Dynamic custom fields based on camping option
     - [ ] Implement field validation based on type (min/max values, string lengths)
     - [ ] Show appropriate input types (numeric, date, text, etc.)
     - [ ] Support conditional field display based on selected camping options
   - [ ] Terms acceptance functionality
     - [ ] Display camp terms from core configuration
     - [ ] Require explicit acceptance with checkbox or similar control
     - [ ] Store acceptance with registration record
   - [ ] Work shift selection based on camping options
   - [ ] Payment for registration depending on camping options selected, accounting for different staff pricing that applies to admin or staff users
   - [?] Alternative handling when shifts are full

4. [ ] Payment processing
   - [ ] Stripe integration
   - [ ] PayPal integration
   - [ ] Deferred payment handling
   - [ ] Payment failure handling

5. [ ] Registration modification
   - [ ] Editing existing registrations
   - [ ] Adding camping options
   - [ ] Changing work shifts
   - [ ] Making payments for deferred/failed payments

6. [ ] Work schedule management
   - [ ] Job shift browsing
   - [ ] Shift registration
   - [ ] Schedule viewing by day/category
     - [ ] Implement grouped view by day and category
     - [ ] Show available spots per shift
     - [ ] Different views for staff vs. regular users
     - [ ] Allow filtering and searching
   - [ ] Conflict detection for overlapping shifts

7. [ ] Notification system
   - [x] UI notifications component
   - [ ] Email notifications for registration events
   - [ ] UI for notification history/preferences

8. [ ] Staff pages
   - [ ] Registration reports with filtering/export
   - [ ] User reports with filtering/export
   - [ ] Work schedule management

9. [ ] Admin pages
   - [x] User management
   - [x] Core configuration management
     - [x] Basic camp information settings
     - [x] Banner and icon configuration with alt text fields
     - [x] Registration settings management
     - [x] Payment processor configuration
     - [x] Email configuration
     - [x] System settings (timezone)
   - [x] Camping options configuration
     - [x] Create basic CRUD operations for camping options
     - [x] Custom fields management for camping options
     - [ ] Fix: Constraints not always showing (multiline max)
     - [ ] Fix: Show friendly names for Type in list view
   - [ ] Job/category management
     - [x] Basic CRUD for job categories
     - [x] Support for "staff only" job category designation
     - [x] Support for "always required" job category functionality
     - [ ] Job management interface for creating and editing jobs
   - [x] Shift management
     - [x] Create and manage job shifts
   - [ ] Payment management (including manual payments)
   - [ ] Refund processing
     - [ ] Interface for admins to initiate refunds
     - [ ] Support automated refunds via payment processors
     - [ ] Manual refund recording
     - [ ] Registration status update after refund

10. [ ] Data management
    - [ ] Data export functionality (CSV/Excel)
    - [ ] Appropriate input controls for different data types
    - [ ] Date/time handling with timezone support

## Security Implementation Plan

### Authentication & JWT Storage

The application will use HTTP-only cookies for JWT storage with the following approach:

1. **Cookie Configuration**
   - HTTP-only: Prevents JavaScript access (XSS protection)
   - Secure flag: Ensures cookies only sent over HTTPS
   - SameSite=Lax: Reasonable CSRF protection while allowing redirects
   - Domain scoped to application domain

2. **Token Management**
   - Short-lived access token (1 hour)
   - Longer-lived refresh token (7 days)
   - Automatic refresh mechanism via API intercept

3. **Security Considerations**
   - CSRF protection for state-changing operations
   - Proper session invalidation on logout
   - Token structure will follow JWT best practices with minimal claims

This approach balances security and usability for the camp registration system, which is not a high-security application but requires reasonable protection.

## Accessibility Implementation Plan

To ensure WCAG 2.2 compliance for dynamic content from Core Configuration:

1. **Banner and Image Accessibility**
   - [x] Add `bannerAltText` field to Core Configuration to store descriptive alt text for banner images
   - [x] Add `iconAltText` field to Core Configuration for camp icon alt text
   - [x] Implement proper image loading patterns with fallbacks and loading states
   - [x] Support for both relative and absolute URLs for better portability

2. **Rich Text Content Accessibility**
   - Sanitize HTML from campDescription and homePageBlurb
   - Ensure proper heading structure in rendered HTML content
   - Validate that dynamically-rendered HTML maintains semantic structure
   - Check color contrast for dynamic content against backgrounds

3. **Dynamic UI Components**
   - Ensure all dynamic form fields have proper labels and ARIA attributes
   - Implement keyboard navigation for dynamically-generated content
   - Add focus management for dynamically-changing content
   - Ensure all interactive elements have visible focus states

4. **Responsive Design for Accessibility**
   - Test dynamic content at various zoom levels (up to 400%)
   - Ensure text reflow at higher zoom levels
   - Test with screen readers to verify announcements of dynamic content changes

These requirements will be integrated throughout the component development process to ensure all dynamically-specified visual elements are fully accessible.

## API Accessibility Implementation Guide

To implement the new alt text fields added to the Core Configuration API:

1. **API Changes Already Made:**
   - Added `campBannerAltText` and `campIconAltText` fields to the database schema
   - Updated all relevant DTOs and service implementations
   - Created database migrations
   - Added custom `IsUrlOrRelativePath` validator to support both relative and absolute URLs
   - Enhanced Core Configuration API to handle creation when updating non-existent configuration

2. **Web Implementation Requirements:**
   - Update API client types to include new alt text fields
   - Modify the `AccessibleImage` component to handle alt text from API
   - Add alt text input fields to Core Configuration admin forms
   - Implement fallback alt text logic when none is provided:
     ```typescript
     const altText = image.altText || `${campName} ${imageName}`; // Fallback
     ```
   - Add validation to ensure alt text is provided when images are uploaded/configured

3. **Testing Considerations:**
   - Test screen reader compatibility with dynamic images
   - Verify alt text is properly associated with images
   - Test fallback behavior when alt text is missing

These changes ensure that all dynamic images specified through Core Configuration have proper alt text for accessibility compliance.

## Updated Project Structure

The current structure has been simplified compared to the original plan. Here's the refined structure that matches our current needs:

```
web/
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── layout/              # Layout components (Header, Footer, etc.)
│   │   ├── auth/                # Authentication-specific components
│   │   ├── home/                # Home page components
│   │   ├── common/              # Basic UI elements (Button, Input, etc.) - NEEDED
│   │   ├── forms/               # Form-related components - NEEDED
│   │   ├── data/                # Data display components - NEEDED
│   │   ├── registration/        # Registration-specific components - NEEDED
│   │   ├── profile/             # User profile components - NEEDED
│   │   ├── admin/               # Admin-specific components - NEEDED
│   │   └── staff/               # Staff-specific components - NEEDED
│   ├── pages/                   # Page components - NEEDED
│   │   ├── public/              # Public pages
│   │   ├── auth/                # Authentication pages 
│   │   ├── user/                # User-specific pages
│   │   ├── registration/        # Registration flow pages
│   │   ├── schedule/            # Work schedule pages
│   │   ├── staff/               # Staff-only pages
│   │   └── admin/               # Admin-only pages
│   ├── hooks/                   # Custom React hooks - NEEDED
│   ├── store/                   # Context providers (renamed from 'context')
│   ├── lib/                     # Library wrappers and API client
│   ├── types/                   # TypeScript types/interfaces
│   ├── constants/               # Application constants - NEEDED
│   └── assets/                  # Static assets - NEEDED
├── public/                      # Public static assets
├── tests/                       # Test files
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── e2e/                     # E2E tests
└── config files...              # package.json; tsconfig.json; etc.
```

Note: Components marked with "NEEDED" should be created as part of the implementation plan.

### Frontend Tasks

- [x] Setup Frontend Application Structure
  - [x] Set up react router
  - [x] Create page components for main routes
  - [x] User authentication context
  - [x] Protected routes implementation
  - [x] Navigation component
  - [x] API client setup

- [x] Authentication Flows
  - [x] Email-based authentication
  - [x] Email verification flow
  - [x] User registration
  - [x] Profile completion
  - [x] Login/logout functionality
  - [x] Auth state persistence

- [ ] Admin Section
  - [x] Admin dashboard view
  - [x] Camp configuration management
  - [x] Camping options configuration (Note: Custom fields management needs to be implemented)
  - [ ] User management interface
  - [ ] Reports and analytics view
  - [ ] System settings

- [ ] User Dashboard
  - [ ] Personal profile management
  - [ ] Registration status view
  - [ ] Payment history
  - [ ] Shift signup interface
  - [ ] Notification center

- [ ] Registration Flow
  - [ ] Multi-step registration process
  - [ ] Camping option selection
  - [ ] Custom fields based on selection
  - [ ] Terms acceptance
  - [ ] Payment integration
  - [ ] Confirmation page

- [ ] Volunteer Shift Management
  - [ ] Available shifts view
  - [ ] Shift signup functionality
  - [ ] Shift calendar view
  - [ ] Volunteer hours tracking
  - [ ] Department-specific views

- [ ] Responsive Design
  - [ ] Mobile-friendly layouts
  - [ ] Responsive navigation
  - [ ] Touch-friendly interface elements
  - [ ] Offline support

- [ ] Testing
  - [x] Unit tests for components
  - [x] Unit tests for hooks
  - [ ] Integration tests
  - [ ] End-to-end tests
  - [ ] Accessibility tests