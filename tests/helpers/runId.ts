/**
 * Per-run identifier used to namespace all data created by a single Playwright run.
 * Set in globalSetup and exposed via E2E_RUN_ID. Prefix is short to keep emails readable.
 */
export const RUN_ID = process.env.E2E_RUN_ID ?? `local-${Date.now().toString(36)}`;

export const TEST_DOMAIN = 'test.playaplan.local';

/** Prefix used by globalTeardown to identify rows safe to delete. */
export const TEST_EMAIL_PREFIX = `e2e-${RUN_ID}`;

/**
 * Build an email address scoped to this run. The local-part stays well under
 * RFC 5321's 64-char limit by truncating the scope; if you need uniqueness
 * across parallel workers/retries, use {@link uniqueTestEmail}.
 */
export function testEmail(scope: string): string {
  const safeScope = scope.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 24);
  const local = truncateLocal(`${TEST_EMAIL_PREFIX}-${safeScope}`);
  return `${local}@${TEST_DOMAIN}`;
}

export function workerEmail(workerIndex: number, scope: string): string {
  return testEmail(`w${workerIndex}-${scope}`);
}

export interface TestIdentity {
  workerIndex: number;
  retry: number;
}

/**
 * Retry-safe per-test email. Combines the run prefix with worker, retry, and a
 * scope tag so retries don't collide with rows created by the previous attempt.
 */
export function uniqueTestEmail(testInfo: TestIdentity, scope: string): string {
  const safeScope = scope.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 16);
  const local = truncateLocal(
    `${TEST_EMAIL_PREFIX}-${safeScope}-w${testInfo.workerIndex}-r${testInfo.retry}`,
  );
  return `${local}@${TEST_DOMAIN}`;
}

/**
 * RFC 5321 caps the local-part of an address at 64 octets, and the app's
 * email validator enforces it. Truncate defensively so callers don't have to
 * count characters every time the run-id length changes.
 */
function truncateLocal(local: string): string {
  return local.length <= 64 ? local : local.slice(0, 64);
}
