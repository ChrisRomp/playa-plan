# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PlayaPlan is a web application for Burning Man theme camps to manage camp sign-ups. The system allows participants to register for camp, select camping options, sign up for required work shifts, and pay dues. It features user management, camping option configuration, job/shift scheduling, and payment processing.

The project is structured as a monorepo with:
- Backend API (NestJS) in `apps/api`
- Frontend web app (React/Vite) in `apps/web`
- Shared TypeScript types in `libs/types`

## Development Commands

### Root Project Commands

```bash
# Start both API and web dev servers
npm run dev

# Start just the API dev server
npm run dev:api

# Start just the web dev server
npm run dev:web

# Run all tests across workspaces
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Format code with Prettier
npm run format

# Lint code
npm run lint

# Clean node_modules and build artifacts
npm run clean
```

### API-specific Commands (in apps/api directory)

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations in development
npm run prisma:migrate:dev

# Run database migrations in test environment
npm run prisma:migrate:test

# Run database migrations in production
npm run prisma:migrate:prod

# Reset database (development)
npm run prisma:reset

# Reset database (test)
npm run prisma:reset:test

# Run Prisma Studio (database GUI)
npm run prisma:studio

# Seed database (development)
npm run seed:dev

# Seed database (test)
npm run seed:test

# Set up database for development (generate, migrate, seed)
npm run db:setup

# Set up database for testing (generate, migrate, seed)
npm run db:setup:test

# Run E2E tests
npm run test:e2e
```

### Web-specific Commands (in apps/web directory)

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Architecture

### Database (PostgreSQL with Prisma)

The data model includes:
- Users (with roles: admin, staff, participant)
- Camps
- Camping options and custom fields
- Job categories and jobs
- Shifts and registrations
- Payments and notifications
- Core configuration

### Backend (NestJS)

The API is built with NestJS, organized into modules:
- auth: Authentication and authorization
- users: User management
- camps: Camp management
- camping-options: Camp sign-up options
- jobs: Work shift categories and definitions
- shifts: Work shift scheduling
- registrations: User registrations for camp
- payments: Payment processing (Stripe, PayPal)
- notifications: Email communication
- core-config: Site configuration

### Frontend (React/Vite)

The web app is built with React and Vite:
- Uses React Router for navigation
- React Query for data fetching
- Context API for global state
- Tailwind CSS for styling
- Testing with Vitest and Testing Library

## Development Guidelines

### General Principles

- Use Test-Driven Development (TDD) as much as possible
- Follow SOLID principles
- Methods should do one thing only
- Maximum method length: 20 lines where practical
- Descriptive naming:
  - Methods: verb + noun (e.g., validateCredentials)
  - Classes: noun (e.g., CredentialValidator)
  - Tests: should + behavior (e.g., shouldValidateCredentials)
- No abbreviations unless universally known
- Keep nesting level <= 2 where practical
- Avoid using raw SQL queries where practical; use Prisma ORM for database interactions

### TypeScript Guidelines

- Use English for all code and documentation
- Always declare the type of each variable and function (parameters and return value)
- Avoid using `any`
- Create necessary types
- Use JSDoc to document public classes and methods
- Don't leave blank lines within a function
- One export per file
- Fix linting errors before committing

### Nomenclature

- Use PascalCase for classes
- Use camelCase for variables, functions, and methods
- Use kebab-case for file and directory names
- Use UPPERCASE for environment variables
- Avoid magic numbers and define constants
- Start each function with a verb
- Use verbs for boolean variables (isLoading, hasError, canDelete, etc.)
- Use complete words instead of abbreviations and correct spelling

### Backend (NestJS) Guidelines

- Use modular architecture
- Encapsulate the API in modules (one module per main domain/route)
- One controller per route
- DTOs validated with class-validator for inputs
- One service per entity
- Use Prisma ORM for data management
- Secure REST API requirements:
  - Ensure all endpoints are protected by authentication and authorization
  - Validate all user inputs and sanitize data
  - Implement rate limiting and throttling
  - Implement logging and monitoring for security events

### Frontend (React) Guidelines

- Don't use `import React from 'react';` in files (not needed with React 17+ and TypeScript)
- Use React Hook Form for form handling
- Use Tailwind CSS for styling
- Use Zod for type safety and shared validation with backend

### Testing Guidelines

- Follow the Arrange-Act-Assert convention for tests
- Name test variables clearly (inputX, mockX, actualX, expectedX, etc.)
- Write unit tests for each public function
- Use test doubles to simulate dependencies
- Write acceptance tests for each module
- Follow the Given-When-Then convention
- Test both success and error paths
- Use descriptive test names that explain behavior

## Common Workflows

### User Registration Flow
1. User creates account with email verification
2. User completes profile
3. User selects camping options
4. User signs up for required work shifts
5. User pays dues if required
6. User receives confirmation

### Database Changes
1. Modify `schema.prisma`
2. Run `npm run prisma:migrate:dev` to create migration
3. Run `npm run prisma:generate` to update client
4. Update corresponding service/controller logic

### Adding a New API Endpoint
1. Create DTO if needed
2. Add method to service
3. Add endpoint to controller
4. Add tests for service and controller
5. Create hook in frontend to consume the endpoint

## Important Notes

- The backend uses Prisma ORM to interact with PostgreSQL
- If local Postgres is needed and is not running, prompt the user to start it.
- Authentication is handled via JWT tokens and email verification
- In development mode, the authentication code email is sent to the console, and is always 123456 for testing
- Frontend uses React Query for API communication and state management
- The project is designed to be customizable for different camps' needs
- Data is strongly typed with shared types in libs/types
- Node.js version 22 or higher is required
- When working from a checklist document, keep the checklist up to date by checking off items as you progress
- Do not work in the `main` branch; ensure work takes place in a task-specific branch
- Commit changes to git after each checked item; do not bypass signing commits
- Do not push changes

# Tone
- If I tell you that you are wrong, think about whether or not you think that's true and respond with facts.
- Avoid apologizing or making conciliatory statements.
- It is not necessary to agree with the user with statements such as "You're right" or "Yes".
- Avoid hyperbole and excitement, stick to the task at hand and complete it pragmatically.
