# PlayaPlan Project Overview

This document provides a comprehensive overview of the PlayaPlan project, including its architecture, technologies, and development conventions.

## Project Summary

PlayaPlan is a web application designed to help Burning Man theme camps manage their annual registration process. It features a user-friendly interface for participants to sign up, select camping options, and choose work shifts. Administrators have access to a dashboard for managing users, configurations, and payments.

**GitHub Repository**: https://github.com/ChrisRomp/playa-plan

The project is structured as a monorepo with two main applications:

*   **`apps/api`**: A NestJS-based backend that provides a RESTful API for the frontend.
*   **`apps/web`**: A React-based frontend built with Vite and styled with Tailwind CSS.

## Key Technologies

*   **Frontend**: React, Vite, Tailwind CSS, React Router, TanStack Query
*   **Backend**: NestJS, Prisma, PostgreSQL
*   **Testing**: Playwright (end-to-end), Vitest (frontend unit), Jest (backend unit/e2e)
*   **Deployment**: Docker, Azure

## Building and Running the Project

### Prerequisites

*   Node.js (version 22 or higher)
*   Docker
*   PostgreSQL

### Installation

To install the project dependencies, run the following command from the root directory:

```bash
npm install
```

### Development

To start the development servers for both the frontend and backend, run:

```bash
npm run dev
```

This will start the frontend on `http://localhost:5173` and the backend on `http://localhost:3000`.

### Building for Production

To build the project for production, run:

```bash
npm run build
```

This will create optimized builds of the frontend and backend in their respective `dist` directories.

### Testing

The project includes a comprehensive test suite with unit, integration, and end-to-end tests.

*   **Run all tests:**
    ```bash
    npm test
    ```

*   **Run end-to-end tests with Playwright:**
    ```bash
    npm run test:e2e
    ```

## Development Conventions

### Code Style

The project uses Prettier for code formatting and ESLint for linting. Please ensure that you have the appropriate editor extensions installed to automatically format your code on save.

To run the linter, use the following command:

```bash
npm run lint
```

### Database

The database schema is managed using Prisma migrations. To apply migrations, use the following commands:

*   **Generate a new migration:**
    ```bash
    npm run prisma:migrate:dev --workspace=api
    ```

*   **Apply migrations:**
    ```bash
    npm run prisma:migrate:deploy --workspace=api
    ```

### Authentication

The application uses a JWT-based authentication system. The backend handles user authentication and authorization, and the frontend stores the JWT in a secure manner.

### Deployment

The application is designed to be deployed to Azure using Docker containers. The `azure.yaml` file defines the services and their configurations for deployment.

## Detailed Development Guidelines

*   **TDD/SOLID**: Use Test-Driven Development (TDD) and SOLID principles wherever possible.
*   **Naming Conventions**: Use descriptive naming for methods (verb+noun), classes (noun), and tests (should+behavior).
*   **TypeScript**: Strictly typed, avoid `any`, use JSDoc for documentation.
*   **Keep it Simple**: Keep nesting levels to a minimum (<=2) and method length short (<=20 lines).
*   **Frontend**: Use React Hook Form for forms and Zod for validation. Do not use `import React from 'react';`.
*   **Backend**: Use modular architecture, DTOs for input validation, and secure all endpoints.

## Workspace-specific Commands

### API (`apps/api`)

*   `npm run prisma:generate`: Generate Prisma client.
*   `npm run prisma:migrate:dev`: Run database migrations in development.
*   `npm run db:setup`: Setup database for development (generate, migrate, seed).
*   `npm run test:e2e`: Run API E2E tests.

### Web (`apps/web`)

*   `npm run dev`: Run development server.
*   `npm run build`: Build for production.
*   `npm run test`: Run unit tests.

## Common Workflows

*   **User Registration**: User creates account -> completes profile -> selects camping options -> signs up for shifts -> pays dues -> receives confirmation.
*   **Database Changes**: Modify `schema.prisma` -> run `npm run prisma:migrate:dev` -> run `npm run prisma:generate` -> update service/controller logic.
*   **New API Endpoint**: Create DTO -> add method to service -> add endpoint to controller -> add tests -> create frontend hook.

## Important Notes

*   **Dev Auth Code**: In development mode, the email authentication code is always `123456`.
*   **Git Workflow**: Do not work in the `main` branch. Create a task-specific branch for your work. Commit changes after each completed checklist item.