# AGENTS.md

Guidance for AI coding assistants (Copilot, Claude, Gemini, etc.) working in
this repository. Keep this file lean — code, `package.json`, and the path-scoped
instructions under `.github/instructions/` are the source of truth for details.

## Project

PlayaPlan is a web application for Burning Man theme camps to manage annual
camp registration: user sign-up, camping options, work-shift scheduling, and
payments.

Repository: https://github.com/ChrisRomp/playa-plan

Monorepo layout:
- `apps/api` — NestJS + Prisma + PostgreSQL backend
- `apps/web` — React + Vite + Tailwind frontend
- `libs/` — shared TypeScript types, constants, validation, utils

## Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod
- **Backend:** NestJS, TypeScript, Prisma ORM, PostgreSQL
- **Auth:** Passport.js (JWT) with email auth codes; optional magic-link login
- **Payments:** Stripe, PayPal
- **Notifications:** SendGrid / Mailgun / Postmark
- **Tests:** Vitest (web), Jest (api), Playwright (e2e)

## Dev essentials

- Node.js **22 or higher**
- `npm run dev` — start both API and web
- Dev-mode email auth code is **always `123456`**
- If local Postgres isn't running, prompt the user to start it
- See `package.json` workspaces for the full script list

## Workflow rules

- **Do not work on `main`.** Create a task-specific branch.
- **Sign all commits.** Do not bypass signing even if signing errors out — stop and ask.
- **Do not push.** The user pushes.
- When working from a checklist doc, check items off as you go and commit after each item.
- Fix lint errors before committing.

## Code style

General:
- TDD where practical; SOLID; one thing per method (~20 lines where practical)
- Naming: methods `verb+noun` (`validateCredentials`), classes nouns
  (`CredentialValidator`), tests `should + behavior` (`shouldValidateCredentials`)
- No abbreviations except universal ones (API, URL) and loop/middleware idioms
  (`i`, `j`, `err`, `ctx`, `req`, `res`, `next`)

TypeScript:
- Explicit types on parameters and return values
- Avoid `any`; prefer `unknown` when a precise type isn't possible
- `interface` for object shapes; `type` for unions/intersections
- `readonly` for immutable values
- One export per file; JSDoc on public classes/methods

NestJS (`apps/api`):
- Modular: one module per domain, one controller per route, one service per entity
- Keep controllers thin; business logic lives in services
- Validate inputs with DTOs + class-validator
- Use Prisma; avoid raw SQL where practical
- All endpoints behind authn/authz; sanitize inputs; log security events

React (`apps/web`):
- Functional components with hooks; no `import React from 'react'` (not needed with React 17+)
- React Hook Form for forms; Zod for validation (shared with backend where possible)
- Tailwind for styling

Tests:
- Arrange-Act-Assert; for behavioral tests, Given-When-Then
- Descriptive `should...` names; cover success and error paths
- Variables: `inputX`, `mockX`, `actualX`, `expectedX`

## Path-scoped instructions

For deeper, area-specific guidance, see:
- `.github/instructions/api-nestjs-development.instructions.md` — backend
- `.github/instructions/frontend-development.instructions.md` — frontend
- `.github/instructions/project-structure.instructions.md` — folder layout

## Tone

- If I tell you that you are wrong, think about whether you think that's true and respond with facts.
- Avoid apologizing or making conciliatory statements.
- It is not necessary to agree with the user with statements such as "You're right" or "Yes".
- Avoid hyperbole and excitement; stick to the task and complete it pragmatically.
