# PlayaPlan Web Frontend

## Initial Setup Tasks

1. [x] Set up base Vite React TypeScript project
2. [x] Add Tailwind CSS
3. [x] Set up project structure according to the plan
4. [x] Configure ESLint and Prettier
5. [x] Configure Vitest for unit testing
6. [ ] Create basic shared components (with typed props):
   - [x] Button
   - [x] Input
   - [ ] Form
   - [x] Card
   - [x] Modal
   - [ ] DataTable (with sorting/filtering/grouping)
   - [x] Notification
   - [x] AccessibleImage (with alt text handling)
   - [x] RichTextContent (with sanitization and accessibility)
7. [x] Set up basic routing (using React Router)
8. [x] Create auth context and login/register pages (include loading/error states)
9. [x] Set up basic API client
10. [x] Create initial home page with responsive layout
11. [ ] Implement WCAG 2.2 accessibility standards
    - [x] Implement proper focus management
    - [x] Add keyboard navigation support
    - [ ] Ensure screen reader compatibility
    - [x] Configure proper ARIA attributes

## Feature Roadmap

1. [ ] User authentication system
   - [x] Email authorization code login process (handled by API?)
   - [ ] JWT persistence using HTTP-only cookies
     - [ ] Set up cookie service utility
     - [ ] Configure secure but practical cookie settings (Secure, SameSite Lax)
     - [ ] Implement automatic token refresh mechanism
     - [ ] Handle session expiration gracefully
   - [x] User registration
   - [ ] CAPTCHA integration for security

2. [ ] User profile management
   - [ ] Complete profile form with all required fields
   - [ ] Email change process with verification
   - [ ] Profile editing

3. [ ] Camp registration system
   - [ ] Registration flow with profile confirmation
   - [ ] Camping option selection with capacity indicators
   - [ ] Dynamic custom fields based on camping option
   - [ ] Terms acceptance functionality
   - [ ] Work shift selection based on camping options
   - [ ] Alternative handling when shifts are full

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

7. [ ] Notification system
   - [x] UI notifications component
   - [ ] Email notifications for registration events
   - [ ] UI for notification history/preferences

8. [ ] Staff pages
   - [ ] Registration reports with filtering/export
   - [ ] User reports with filtering/export
   - [ ] Work schedule management

9. [ ] Admin pages
   - [ ] User management
   - [ ] Core configuration management
     - [ ] Basic camp information settings
     - [ ] Banner and icon configuration with alt text fields
     - [ ] Registration settings management
     - [ ] Payment processor configuration
   - [ ] Camping options configuration
   - [ ] Job/category management
   - [ ] Shift management
   - [ ] Payment management (including manual payments)
   - [ ] Refund processing

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
   - Add `bannerAltText` field to Core Configuration to store descriptive alt text for banner images
   - Add `iconAltText` field to Core Configuration for camp icon alt text
   - Implement proper image loading patterns with fallbacks and loading states

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

## Project Structure

Following the defined structure in `/apps/web`:

```
web/
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── common/              # Basic UI elements (Button, Input, etc.)
│   │   ├── layout/              # Layout components (Header, Footer, etc.)
│   │   ├── forms/               # Form-related components
│   │   ├── data/                # Data display components (Tables, etc.)
│   │   ├── auth/                # Authentication-specific components
│   │   ├── registration/        # Registration-specific components
│   │   ├── payment/             # Payment-related components
│   │   └── admin/               # Admin-specific components
│   ├── pages/                   # Page components
│   │   ├── public/              # Public pages
│   │   ├── auth/                # Authentication pages
│   │   ├── user/                # User-specific pages
│   │   ├── registration/        # Registration flow pages
│   │   ├── schedule/            # Work schedule pages
│   │   ├── staff/               # Staff-only pages
│   │   └── admin/               # Admin-only pages
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.ts           # Authentication hooks with cookie handling
│   │   ├── useForm.ts           # Form handling hooks
│   │   ├── useApi.ts            # API interaction hooks
│   │   ├── useCookies.ts        # Cookie management hook
│   │   └── useNotification.ts   # Notification hooks
│   ├── context/                 # React context providers
│   │   ├── AuthContext.tsx      # Authentication context with cookie-based session
│   │   ├── NotificationContext.tsx  # Notification context
│   │   ├── ConfigContext.tsx    # App configuration context
│   │   └── ThemeContext.tsx     # Theme/styling context
│   ├── api/                     # API client code
│   │   ├── client.ts            # Base API client with cookie handling
│   │   ├── auth.ts              # Authentication API calls with refresh token logic
│   │   ├── users.ts             # User-related API calls
│   │   ├── registration.ts      # Registration-related API calls
│   │   ├── payments.ts          # Payment-related API calls
│   │   ├── schedule.ts          # Schedule-related API calls
│   │   ├── config.ts            # Configuration API calls with accessibility fields
│   │   └── admin.ts             # Admin-related API calls
│   ├── utils/                   # Utility functions
│   │   ├── cookies.ts           # Cookie management utility
│   │   ├── date.ts              # Date/time utilities
│   │   ├── validation.ts        # Form validation utilities
│   │   ├── formatting.ts        # Data formatting utilities
│   │   └── accessibility.ts     # Accessibility helpers
│   ├── types/                   # TypeScript types/interfaces
│   │   ├── api.ts               # API response/request types
│   │   ├── auth.ts              # Authentication types
│   │   ├── user.ts              # User-related types
│   │   ├── registration.ts      # Registration-related types
│   │   ├── payment.ts           # Payment-related types
│   │   └── admin.ts             # Admin-related types
│   ├── constants/               # Application constants
│   │   ├── routes.ts            # Route definitions
│   │   ├── apiEndpoints.ts      # API endpoint constants
│   │   └── messages.ts          # UI message constants
│   ├── assets/                  # Static assets
│   │   ├── images/              # Image assets
│   │   ├── styles/              # Global style overrides
│   │   └── icons/               # Icon assets
│   └── lib/                     # Third-party library wrappers
│       ├── stripe.ts            # Stripe integration
│       └── paypal.ts            # PayPal integration
├── public/                      # Public static assets
├── tests/                       # Test files
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── e2e/                     # Playwright E2E tests
└── config files...              # package.json; tsconfig.json; ...
```