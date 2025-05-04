# PlayaPlan Web Frontend

## Initial Setup Tasks

1. [ ] Set up base Vite React TypeScript project
2. [ ] Add Tailwind CSS
3. [ ] Set up project structure according to the plan
4. [ ] Configure ESLint and Prettier
5. [ ] Configure Vitest for unit testing
6. [ ] Create basic shared components (with typed props):
   - [ ] Button
   - [ ] Input
   - [ ] Form
   - [ ] Card
   - [ ] Modal
   - [ ] DataTable (with sorting/filtering/grouping)
   - [ ] Notification
7. [ ] Set up basic routing (using React Router)
8. [ ] Create auth context and login/register pages (include loading/error states)
9. [ ] Set up basic API client
10. [ ] Create initial home page with responsive layout
11. [ ] Implement WCAG 2.2 accessibility standards

## Feature Roadmap

1. [ ] User authentication system
   - [ ] Email authorization code login process
   - [ ] JWT persistence using HTTP-only cookies
     - [ ] Set up cookie service utility
     - [ ] Configure secure but practical cookie settings (Secure, SameSite Lax)
     - [ ] Implement automatic token refresh mechanism
     - [ ] Handle session expiration gracefully
   - [ ] User registration
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
   - [ ] Email notifications for registration events
   - [ ] UI for notification history/preferences

8. [ ] Staff pages
   - [ ] Registration reports with filtering/export
   - [ ] User reports with filtering/export
   - [ ] Work schedule management

9. [ ] Admin pages
   - [ ] User management
   - [ ] Core configuration management
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