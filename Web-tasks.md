# PlayaPlan Web Frontend

## Technology Choices (Simple Stack)

Keeping simplicity in mind, we'll use:

- **Core Framework:** React with TypeScript
- **Build Tool:** Vite (faster, simpler than CRA)
- **Styling:** Tailwind CSS (rapid UI development)
- **Component Library:** Headless UI (simple, accessible components that work with Tailwind)
- **Form Handling:** React Hook Form (simple but powerful)
- **Data Fetching:** Simple fetch API to start (can upgrade to TanStack Query later if needed)
- **Validation:** Zod (for type safety and shared validation with backend)
- **Testing:** 
  - Unit Tests: Vitest (works well with Vite)
  - E2E Tests: Playwright (cross-browser, modern API)

## Initial Setup Tasks

1. [ ] Set up base Vite React TypeScript project
2. [ ] Add Tailwind CSS
3. [ ] Set up project structure according to the plan
4. [ ] Configure ESLint and Prettier
5. [ ] Configure Vitest for unit testing
6. [ ] Create basic shared components
   - [ ] Button
   - [ ] Input
   - [ ] Form
   - [ ] Card
   - [ ] Modal
7. [ ] Set up basic routing
8. [ ] Create auth context and login/register pages
9. [ ] Set up basic API client
10. [ ] Create initial home page

## Feature Roadmap

1. [ ] User authentication pages
   - [ ] Login
   - [ ] Register
   - [ ] Forgot Password
2. [ ] User profile management
3. [ ] Camp session browsing
4. [ ] Job shift browsing and registration
5. [ ] Admin pages
   - [ ] User management
   - [ ] Camp session management
   - [ ] Job management
   - [ ] Shift management

## Project Structure

Following the defined structure in `/apps/web`:

```
web/
├── src/
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── context/            # React context providers
│   ├── api/                # API client code
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript types/interfaces
│   └── assets/             # Static assets
├── public/
├── tests/                  # Playwright E2E tests
└── config files...
```