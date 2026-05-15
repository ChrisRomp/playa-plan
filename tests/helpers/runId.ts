/**
 * Per-run identifier used to namespace all data created by a single Playwright run.
 * Set in globalSetup and exposed via E2E_RUN_ID. Prefix is short to keep emails readable.
 */
export const RUN_ID = process.env.E2E_RUN_ID ?? `local-${Date.now().toString(36)}`;

export const TEST_DOMAIN = 'test.playaplan.local';

/** Prefix used by globalTeardown to identify rows safe to delete. */
export const TEST_EMAIL_PREFIX = `e2e-${RUN_ID}`;

export function testEmail(scope: string): string {
  const safeScope = scope.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `${TEST_EMAIL_PREFIX}-${safeScope}@${TEST_DOMAIN}`;
}

export function workerEmail(workerIndex: number, scope: string): string {
  return testEmail(`w${workerIndex}-${scope}`);
}
