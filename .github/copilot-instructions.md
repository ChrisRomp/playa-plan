# PlayaPlan Project Summary

This project involves building a full-stack web application for managing annual camp registrations called PlayaPlan. The application enables user registration, profile management, and authentication using JWT and Passport.js. Users will sign up for camp job shifts scheduled within admin-defined camp sessions. Each job has categories and location attributes, and not all jobs are available on all camp dates.

Repository: https://github.com/ChrisRomp/playa-plan

## Agent work

- When working from a checklist document, keep the checklist up to date by checking off items as you progress. Commit changes to git after each checked item. Do not bypass signing commits.

## Development Environment

- Node.js version 22 or higher is required
- For setting up the development environment, refer to [Copilot Setup Documentation](../docs/copilot-setup.md)
- Use `.nvmrc` to ensure the correct Node.js version is used

## Development instructions

- Use clear, easily-readable code whereever possible.
- Document the code.
- Use Test-Driven Development (TDD) as much as possible.
- Follow SOLID principles.
- Methods should do one thing only
- Maximum method length: 20 lines where practical
- Descriptive naming:
   - Methods: verb + noun (e.g., validateCredentials)
   - Classes: noun (e.g., CredentialValidator)
   - Tests: should + behavior (e.g., shouldValidateCredentials)
- No abbreviations unless universally known
- Keep nesting level <= 2 where practical
- Avoid using raw SQL queries where practical; use Prisma ORM for database interactions

### Tone
- If I tell you that you are wrong, think about whether or not you think that's true and respond with facts.
- Avoid apologizing or making conciliatory statements.
- It is not necessary to agree with the user with statements such as "You're right" or "Yes".
- Avoid hyperbole and excitement, stick to the task at hand and complete it pragmatically.

## TypeScript General Guidelines

### Basic Principles

- Use English for all code and documentation.
- Always declare the type of each variable and function (parameters and return value).
- Avoid using any.
- Create necessary types.
- Use JSDoc to document public classes and methods.
- Don't leave blank lines within a function.
- One export per file.
- Fix linting errors (don't use `any` types, no unused variables, etc.) before committing.

### Nomenclature

- Use PascalCase for classes.
- Use camelCase for variables, functions, and methods.
- Use kebab-case for file and directory names.
- Use UPPERCASE for environment variables.
- Avoid magic numbers and define constants.
- Start each function with a verb.
- Use verbs for boolean variables. Example: isLoading, hasError, canDelete, etc.
- Use complete words instead of abbreviations and correct spelling.
- Except for standard abbreviations like API, URL, etc.
- Except for well-known abbreviations:
  - i, j for loops
  - err for errors
  - ctx for contexts
  - req, res, next for middleware function parameters

### Functions

- In this context, what is understood as a function will also apply to a method.
- Write short functions with a single purpose. Less than 20 instructions.
- Name functions with a verb and something else.
- If it returns a boolean, use isX or hasX, canX, etc.
- If it doesn't return anything, use executeX or saveX, etc.
- Avoid nesting blocks by:
  - Early checks and returns.
  - Extraction to utility functions.
- Use higher-order functions (map, filter, reduce, etc.) to avoid function nesting.
- Use arrow functions for simple functions (less than 3 instructions).
- Use named functions for non-simple functions.
- Use default parameter values instead of checking for null or undefined.
- Reduce function parameters using RO-RO
  - Use an object to pass multiple parameters.
  - Use an object to return results.
  - Declare necessary types for input arguments and output.
- Use a single level of abstraction.

## The application stack includes:

- Frontend: React with TypeScript and Tailwind CSS
  - Source in `apps/web`
  - Refer to [frontend-development](./instructions/frontend-development.instructions.md)
- Backend API: NestJS with TypeScript
  - Source in `apps/api`
  - Refer to [api-nestjs-development](./instructions/api-nestjs-development.instructions.md)
- Database: PostgreSQL managed via Prisma ORM
- Authentication: Passport.js (Local and JWT strategies) with authentication code sent via email
  - In development mode, the authentication code email is sent to the console, and is always 123456 for testing
- Payments: Stripe and PayPal integrations
- Notifications: Transactional emails via SendGrid, Mailgun, or Postmark
- Documentation: Swagger (OpenAPI)

## Backend modules planned:

- Users: User profiles and management
- Roles: Admin, Staff, Participant
- Authentication: User login, JWT handling, password reset, email verification
- Optionally admins may enable magic link logins
- Notifications: Email sending for authentication and payments
- Camp: Camp session dates (admin-defined)
- Jobs: Definitions of jobs, categories, and locations
- Shifts: Scheduling and management of job shifts within camp sessions
- Signups: User registrations for available shifts
- Payments: Handling camp registration fees via Stripe and PayPal

Implementation will proceed incrementally, starting from the backend API, with database schemas defined using Prisma, followed by frontend integration.

Planned project structure is outlined in [Project Structure](./instructions/project-structure.instructions.md).

APIs, controllers, modules, etc., should be individually testable.
