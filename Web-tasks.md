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
7. [ ] Set up basic routing (using React Router)
8. [ ] Create auth context and login/register pages (include loading/error states)
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
└── config files...         # package.json; tsconfig.json; ...
```
