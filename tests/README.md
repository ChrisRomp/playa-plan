# PlayaPlan E2E Tests

Playwright-based end-to-end tests for the PlayaPlan stack (`apps/api` + `apps/web`).

## Layout

```
tests/
  helpers/                shared utilities (api, db, auth, stripe, factories, env, runId)
  auth.setup.ts           Playwright "setup" project: logs in each persona once, saves storage state
  smoke/                  fast checks that always run first (@smoke)
  auth/                   email-code login, sign-out, protected-route redirects (@auth)
  profile/                profile view/update (@profile)
  registration/           multi-step user registration flow (@registration, @payment, @deferred)
  admin/                  admin pages (@admin and finer @admin-* sub-tags)
  reports/                report pages (@reports)
  access-control/         RBAC matrix (@rbac)
  .auth/                  generated storage-state JSON per persona (gitignored)
  .legacy specs           old brittle specs parked while being rewritten
```

## Tags

Specs declare tags via the `tag` option on `test.describe(...)`. Use them to run subsets:

| Tag                    | What it covers                                  | npm script                  |
| ---------------------- | ----------------------------------------------- | --------------------------- |
| `@smoke`               | Fast health/render checks                       | `npm run test:e2e:smoke`    |
| `@auth`                | Login, sign-out, protected redirects            | `npm run test:e2e:auth`     |
| `@profile`             | Profile pages                                    | (use `--grep @profile`)     |
| `@registration`        | End-user registration flows                      | `npm run test:e2e:registration` |
| `@payment`             | Stripe payment / refund flows                    | (use `--grep @payment`)     |
| `@deferred`            | Deferred-payment registrations                   | (use `--grep @deferred`)    |
| `@admin`               | Any admin page                                   | `npm run test:e2e:admin`    |
| `@admin-users`, `@admin-registrations`, `@admin-jobs`, `@admin-camping`, `@admin-payments`, `@admin-config` | Per-area admin specs | use `--grep @admin-jobs` etc. |
| `@reports`             | Report pages                                     | `npm run test:e2e:reports`  |
| `@rbac`                | Cross-role access matrix                         | `npm run test:e2e:rbac`     |
| `@slow`                | Tests that take >15s (3DS, refund polling)       | `--grep @slow` to opt in    |

`npm run test:e2e:fast` excludes `@slow`. You can also set `E2E_TAGS=@admin|@auth` to filter
across the board.

## Running locally

### Quick path (fresh DB + auto-managed servers)

```bash
npm run test:e2e:local       # runs scripts/test-e2e.sh: spins up Postgres, runs prisma migrate + seed, boots API + Web, runs Playwright
```

### Authoring mode (reuse an already-running stack)

```bash
# In one terminal:
npm run dev                  # boots API on :3000 and web on :5173

# In another:
npm run test:e2e:dev         # E2E_REUSE_DB=true; skips DB reset and webServer
```

You can also point tests at any host via `E2E_API_URL`, `E2E_WEB_URL`, `E2E_DATABASE_URL`.

### Author with playwright-cli skills

```bash
npm run test:e2e:author      # validates playwright-cli is installed, then opens a headed session
```

If the preflight fails, follow its printed install commands. We never auto-install
`@playwright/cli` globally on your behalf.

## Database & data isolation

- A single shared DB is used for the entire run.
- Every test creates data with a per-run `RUN_ID` prefix (`e2e-${RUN_ID}-…@test.playaplan.local`).
- Workers use that same prefix scoped by `workerIndex` to avoid collisions.
- `globalTeardown.ts` deletes only rows tagged with the run prefix; existing seed data and
  unrelated rows are never touched.
- The "canonical personas" used for storage-state login (admin/staff/participant/etc.) are
  created idempotently by `seed.e2e.ts` and intentionally do **not** carry the run prefix —
  they're shared across runs.

When in doubt, set `E2E_REUSE_DB=true` and run against a dev DB you already trust.

## Seed pipeline

```bash
# From apps/api:
npm run seed:dev           # base camp data (committed)
npm run seed:e2e           # E2E personas (committed, no secrets)
npm run seed:local         # Stripe/PayPal/SMTP creds (gitignored)

# Or in one shot:
npm run seed:e2e:full      # forces seed:dev, then seed:e2e, then seed:local if present
```

Copy `apps/api/prisma/seeds/seed.local.template.ts` to `seed.local.ts` and fill in your
**Stripe test-mode keys** (the template documents which fields and which test cards we use).

## GitHub Actions secret (for CI later)

A single repo secret named `E2E_SEED_LOCAL` will hold the full TS source of `seed.local.ts`.
The CI workflow writes it to `apps/api/prisma/seeds/seed.local.ts` before the seed step.
Rotate the Stripe test key by updating the secret; nothing else changes.

`.gitignore` excludes `seed.local.ts`, so the secret never lands in the repo.

## `playwright-cli` vs `npx playwright test`

These are two different things — both are part of our workflow.

| Tool                                    | Purpose                                                 | When to use                                         |
| --------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `npx playwright test` (or `npm run test:e2e*`) | **Runs** the test suite via the `@playwright/test` runner. | Always. Local runs, CI runs, debugging individual specs (`--debug=cli`). |
| `playwright-cli`                        | Interactive browser automation: drive a page, take snapshots, generate locators, attach to a paused test. | Authoring new specs (skill-driven), debugging a failing test by attaching to its session, exploring the app to find the right selectors. |

The Microsoft skill (`.agents/skills/playwright-cli/SKILL.md`) is the canonical reference and is
worth reading in full. Quick orientation:

- `playwright-cli open http://localhost:5173` — start a headed browser session.
- `playwright-cli snapshot` — get an accessibility tree with refs (e.g. `e15`) you can target.
- `playwright-cli click e15` / `playwright-cli fill e3 "value"` — interact using refs.
- `playwright-cli attach tw-abcdef` — attach to a Playwright test paused via `--debug=cli`.

Our wrapper script `npm run test:e2e:author` runs the preflight check, then opens a headed
session at the local web URL — handy as a starting point for skill-driven authoring.

CI runs `npx playwright test` (with optional `--grep` from the workflow input). It does **not**
need `playwright-cli` installed; the CLI is purely an authoring/debugging convenience.

## Stripe test cards

We use real Stripe test mode (no charges occur). PayPal is intentionally not exercised by E2E.
Common cards (full list: <https://docs.stripe.com/testing>):

| Purpose                                | Number               |
| -------------------------------------- | -------------------- |
| Success                                | 4242 4242 4242 4242  |
| Generic decline                        | 4000 0000 0000 0002  |
| Insufficient funds                     | 4000 0000 0000 9995  |
| 3DS challenge → success                | 4000 0025 0000 3155  |
| 3DS challenge → decline                | 4000 0082 6000 3178  |

Helpers in `tests/helpers/stripe.ts` fill these into Stripe Elements iframes.

## CI

The `e2e-ci.yml` workflow currently runs only on `workflow_dispatch`. It accepts inputs:

- `tags` — forwarded to `playwright test --grep` (e.g. `@smoke|@auth`).
- `reuse_db` — skips the seed step for ad-hoc reruns against an externally provisioned DB.

Path-aware automatic triggers will be added once we have stable timings.
