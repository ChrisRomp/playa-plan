/**
 * Centralized env access for E2E tests. Keep defaults aligned with scripts/test-e2e.sh.
 */

export const API_BASE_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
export const WEB_BASE_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';

/**
 * The web app uses a HashRouter, so all client-side routes live under `/#/...`.
 * Use this helper to construct full URLs for `page.goto()` and assertions.
 */
export function webUrl(path = '/'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${WEB_BASE_URL}/#${normalized}`;
}

export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/playaplan_test';

/**
 * When true, the test suite assumes the API/web stack and DB are already running
 * and skips the reset/seed steps. Used by `npm run test:e2e:dev`.
 */
export const REUSE_DB = process.env.E2E_REUSE_DB === 'true';

/** Dev-mode auth code is always 123456 (see apps/api/src/auth/services/auth.service.ts). */
export const DEV_LOGIN_CODE = '123456';
