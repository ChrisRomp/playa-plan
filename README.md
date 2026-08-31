# PlayaPlan

Annual camp registration management for Burning Man theme camps.

## Overview

PlayaPlan is a self-hostable web application that helps a theme camp run its
yearly sign-up cycle: collecting participant info, offering camping options
and add-ons, scheduling required work shifts, and collecting dues. Each
deployment is configured for a single camp, with branding, camping options,
jobs, shifts, and pricing all controlled from an admin UI.

## Features

**Participants**
- Passwordless login via emailed one-time code, with optional passkeys
- Profile with required and camp-customizable fields
- Browse and select camping options (with per-option custom fields and dues)
- Sign up for required work shifts
- Pay dues online via Stripe or PayPal, or defer payment when enabled
- View application status and continue registration after approval
- Email confirmations and notifications

**Staff**
- Review registration applications when approval is enabled
- View registration, user, work schedule, ticket/receipt, and exception reports
- Export report data as CSV or PDF where supported
- Edit user profiles and add internal notes
- Manage participant access flags (allow registration, allow no-job, etc.)

**Admins**
- Camp/site configuration (name, branding, contact, payment providers, email)
- Manage registration policy, camping options, custom fields, jobs, shifts, and dues
- User and role management (Participant / Staff / Admin)
- Process payments and refunds
- Configure and test transactional email over SMTP
- Admin audit log of sensitive actions

## Tech stack

- **Monorepo** — npm workspaces under `apps/*` and `libs/*`
- **Backend** — [NestJS](https://nestjs.com/) + [Prisma](https://www.prisma.io/) + PostgreSQL (`apps/api`)
- **Frontend** — React 18 + [Vite](https://vitejs.dev/) + Tailwind CSS (`apps/web`)
- **Auth** — JWT with email one-time codes (Passport.js)
- **Payments** — Stripe and PayPal
- **Email** — SMTP via Nodemailer
- **Testing** — Jest (API), Vitest (web), Playwright (E2E)
- **Containers** — Dockerfiles for API and web; Compose file for E2E
- **Deployment assets** — Dockerfiles plus Azure/Bicep templates (`infra/`, `azure.yaml`)

## Requirements

To run PlayaPlan locally you'll need:

- **Node.js 22.13-22.x or 24+** (and the bundled `npm`)
- **PostgreSQL 15+** — local install or container
- A modern browser

Optional, depending on what you want to exercise:

- **Docker** / **Docker Compose** — for containerized runs and the E2E test stack
- **Stripe** and/or **PayPal** account — for live payment flows (test mode is fine)
- **SMTP credentials** — for live transactional email

## Getting started

```bash
# 1. Install
git clone https://github.com/ChrisRomp/playa-plan.git
cd playa-plan
npm install

# 2. Configure
cp .env.sample .env
# edit .env and set DATABASE_URL and JWT_SECRET
# example to set JWT_SECRET with a random string:
sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env && rm .env.bak

# 3. Initialize the database (generate client, run migrations, seed)
npm run db:setup --workspace=api

# 4. Run the API and web app together
npm run dev
```

Defaults:

- API: <http://localhost:3000>
- Web: <http://localhost:5173>
- API docs: <http://localhost:3000/api/docs>
- Dev mode login code: `123456`
- The first user to complete login becomes an admin

For production configuration, first-admin bootstrap, containers, passkeys, and
reverse-proxy settings, see the [setup and self-hosting guide](./docs/setup.md).

## Common scripts

```bash
npm run dev           # start API + web in parallel
npm run dev:api       # start API only
npm run dev:web       # start web only
npm run build         # build all workspaces
npm run lint          # lint the monorepo
npm test              # run all unit tests
npm run test:e2e      # run Playwright E2E tests
```

## Project structure

```text
playa-plan/
├── apps/
│   ├── api/        # NestJS backend, Prisma schema, migrations
│   └── web/        # React + Vite frontend
├── libs/           # Shared TypeScript types and utilities
├── docs/           # Specs, setup, deployment, and feature docs
├── infra/          # Azure infrastructure (Bicep / azd)
├── tests/          # Cross-app Playwright E2E tests
└── scripts/        # Helper scripts (E2E, tooling)
```

## Documentation

More detail lives in [`docs/`](./docs):

- [`setup.md`](./docs/setup.md) — local setup, configuration, and self-hosting
- [`app-spec.md`](./docs/app-spec.md) — full application specification
- [`frontend-spec.md`](./docs/frontend-spec.md) — frontend specification
- [`tests/README.md`](./tests/README.md) — running and authoring Playwright tests
- [`copilot-setup.md`](./docs/copilot-setup.md) — Copilot cloud agent environment
- [`azure-deployment.md`](./docs/azure-deployment.md) — Azure deployment assets and caveats

## License

See [`LICENSE.md`](./LICENSE.md).
