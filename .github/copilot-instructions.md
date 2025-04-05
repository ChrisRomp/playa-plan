# PlayaPlan Project Summary

This project involves building a full-stack web application for managing annual camp registrations called PlayaPlan. The application enables user registration, profile management, and authentication using JWT and Passport.js. Users will sign up for camp job shifts scheduled within admin-defined camp sessions. Each job has categories and location attributes, and not all jobs are available on all camp dates.

## Agent work

- When planning multiple terminal commands, it's ok to `&&` them
  - Example: if doing a `mkdir -p ...` followed by `touch ...` just do one command `mkdir -p ... && touch ...`.
- When working from a checklist document, keep the checklist up to date by checking off items as you progress. Commit changes to git after each cheked item.

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

### Tone
- If I tell you that you are wrong, think about whether or not you think that's true and respond with facts.
- Avoid apologizing or making conciliatory statements.
- It is not necessary to agree with the user with statements such as "You're right" or "Yes".
- Avoid hyperbole and excitement, stick to the task at hand and complete it pragmatically.

## The application stack includes:

- Frontend: React with TypeScript and Tailwind CSS
- Backend API: NestJS with TypeScript
- Database: PostgreSQL managed via Prisma ORM
- Authentication: Passport.js (Local and JWT strategies), with email magic link login to be added later
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

Planned project structure is outlined in [Project Structure](./prompts/project-structure.prompt.md).

APIs, controllers, modules, etc., should be individually testable.
