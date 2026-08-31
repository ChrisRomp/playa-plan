# Setup and self-hosting

This guide covers local development and the runtime configuration required to
self-host PlayaPlan. For Azure-specific assets, see
[`azure-deployment.md`](./azure-deployment.md). For Playwright setup, see
[`../tests/README.md`](../tests/README.md).

## Prerequisites

- Node.js 22.13-22.x or 24+
- npm
- PostgreSQL 15 or later
- A modern browser

Docker is optional for local development. Stripe, PayPal, and SMTP credentials
are only required when exercising those integrations.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the local environment file:

   ```bash
   cp .env.sample .env
   ```

   At minimum, set:

   ```dotenv
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/playaplan?sslmode=prefer&schema=public
   JWT_SECRET=replace-with-a-long-random-value
   ```

   You can generate a JWT secret with a cryptographically secure tool, for example:

   ```bash
   openssl rand -hex 32
   ```

3. Create the PostgreSQL database referenced by `DATABASE_URL`, then generate
   the Prisma client, apply a development migration, and seed the database:

   ```bash
   npm run db:setup --workspace=api
   ```

4. Start the API and web app:

   ```bash
   npm run dev
   ```

The local endpoints are:

| Service | URL |
| --- | --- |
| Web app | <http://localhost:5173> |
| API | <http://localhost:3000> |
| Swagger UI | <http://localhost:3000/api/docs> |
| API health | <http://localhost:3000/health> |

In development mode, every email login uses the code `123456`. The first user
to complete login is promoted to `ADMIN`.

## Configuration model

PlayaPlan separates runtime/bootstrap configuration from camp configuration.

### Runtime and bootstrap environment

The root [`.env.sample`](../.env.sample) documents the normal local values.
Important settings include:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection string |
| `JWT_SECRET` | Required signing secret for authentication tokens |
| `NODE_ENV` | `development`, `production`, or `test` |
| `PORT` | API port; defaults to `3000` |
| `FRONTEND_URL` | Public web origin used for CORS and passkey defaults |
| `CORS_ORIGINS` | Optional comma-separated override for allowed origins |
| `TRUST_PROXY` | Number of trusted reverse-proxy hops; leave unset for direct exposure |
| `INITIAL_ADMIN_CODE` | Optional six-digit first-admin bootstrap code |
| `WEBAUTHN_RP_NAME` | Optional passkey relying-party display name |
| `WEBAUTHN_RP_ID` | Optional passkey relying-party domain |
| `WEBAUTHN_ORIGIN` | Optional passkey browser origin |

The frontend API URL depends on how the web app is run:

- Vite development and build-time configuration use `VITE_API_URL`.
- The production web container reads `API_URL` at startup and writes it into
  `runtime-config.js`.

### Admin-managed configuration

After the first admin login, use the admin UI to configure:

- Camp name, branding, registration year, terms, and registration policy
- Application approval and deferred-payment behavior
- Camping options and custom fields
- Job categories, jobs, and shifts
- SMTP server, sender identity, and email enablement
- Stripe and PayPal credentials and modes

These values are stored in the database. They are not primarily sourced from
environment variables.

## First-admin bootstrap

The first user who successfully verifies a login code becomes an admin.

For a production deployment without working SMTP:

1. Set `INITIAL_ADMIN_CODE` to a six-digit numeric value.
2. Start the API and web app.
3. Request a login code for the intended admin email. This creates the pending
   user record.
4. Enter the `INITIAL_ADMIN_CODE` instead of an emailed code.
5. Confirm the user was promoted to `ADMIN`.
6. Remove `INITIAL_ADMIN_CODE` from the runtime environment and restart the API.
7. Configure and test SMTP from the admin UI.

The bootstrap code is rejected after SMTP is fully configured. Removing it
after first use limits unnecessary privileged access while email is disabled.

## Production checklist

Before exposing PlayaPlan publicly:

1. Use a dedicated PostgreSQL database with backups and restricted credentials.
2. Set `NODE_ENV=production` and use a unique, high-entropy `JWT_SECRET`.
3. Serve both applications over HTTPS.
4. Set `FRONTEND_URL` and the frontend API URL to their public origins.
5. Restrict CORS to the public web origin.
6. Set `TRUST_PROXY` only when a known reverse proxy is in front of the API.
   Use the exact hop count; do not enable blanket trust unnecessarily.
7. Ensure `WEBAUTHN_RP_ID` is the frontend hostname or a registrable parent and
   `WEBAUTHN_ORIGIN` exactly matches the browser origin. The API validates this
   relationship at startup.
8. Keep the API's internal Prometheus endpoint on port `9464` private.
9. Configure SMTP and payment providers in the admin UI using production or
   provider test-mode credentials as appropriate.
10. Exercise login, registration, email, and payment flows before opening
    registration.

## Database initialization

For a source-based production deployment, generate the client, apply committed
migrations, and run the idempotent seed:

```bash
npm run prisma:generate --workspace=api
npm run prisma:migrate:prod --workspace=api
npm run seed:dev --workspace=api
```

> [!WARNING]
> Do not use development migration commands against a production database.

### API container behavior

The current API container entrypoint automatically:

1. Waits for `DATABASE_URL` to become reachable.
2. Runs `prisma db push --accept-data-loss`.
3. Runs the development seed.
4. Builds the API at startup in production mode when `dist/` is absent.

Review this behavior before using the image with production data. It is schema
synchronization, not the migration-only workflow shown above, and
`--accept-data-loss` can permit destructive schema changes. Take a verified
database backup before upgrades.

The repository does not currently include a general production Compose file;
`docker-compose.e2e.yml` is for isolated end-to-end testing.

## Deployment assets

The repository includes API and web Dockerfiles plus Azure Developer CLI/Bicep
assets. They are useful starting points, but the current Azure templates require
configuration review before production:

- Required API values such as `JWT_SECRET` and `FRONTEND_URL` are not currently
  wired through the Bicep template.
- The Bicep template sets `VITE_API_URL`, while the production web container
  consumes `API_URL`.
- The API container performs the automatic database synchronization described
  above.

See [`azure-deployment.md`](./azure-deployment.md) for the Azure-specific
workflow and its current caveats.

## Troubleshooting

### Prisma client types or enums are undefined

Regenerate the Prisma client:

```bash
cd apps/api
npx prisma generate
```

### The API cannot connect to PostgreSQL

Confirm PostgreSQL is running, the database exists, and `DATABASE_URL` contains
the correct host, port, database, credentials, and SSL mode.

### Login email does not arrive

In development, use `123456`. In production bootstrap, follow the
`INITIAL_ADMIN_CODE` procedure above. After bootstrap, enable SMTP in the admin
UI and use its connection and test-email actions.

### Passkey registration fails

Verify HTTPS, `FRONTEND_URL`, `WEBAUTHN_RP_ID`, and `WEBAUTHN_ORIGIN`. Except
for localhost development, browsers require a secure context for passkeys.
