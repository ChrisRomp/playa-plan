/* eslint-disable react-hooks/rules-of-hooks -- `use()` here is the Playwright fixture callback, not a React hook. */
import { test as base } from '@playwright/test';
import { getPrisma } from './db';
import { TEST_EMAIL_PREFIX } from './runId';
import { loginViaUi } from './auth';

export interface FreshUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface FreshFixtures {
  /**
   * A brand-new PARTICIPANT user created per-test, with the page already
   * logged in. The email uses the run-id + spec-title + worker-index so it's
   * guaranteed unique across parallel workers and any retry attempts.
   *
   * No cleanup is required at the test level — the run-id prefix is picked
   * up by globalTeardown's cleanupRunData().
   *
   * Usage:
   *   test.use({ storageState: { cookies: [], origins: [] } });
   *   test('does X', async ({ page, freshParticipant }) => { ... });
   */
  freshParticipant: FreshUser;
}

function slugify(s: string): string {
  return s
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 30);
}

export const test = base.extend<FreshFixtures>({
  freshParticipant: async ({ page }, use, testInfo) => {
    const prisma = getPrisma();
    const slug = slugify(testInfo.title) || 'untitled';
    // Include retry to avoid clashing with rows left behind by a failed prior
    // attempt within the same run.
    const email = `${TEST_EMAIL_PREFIX}-${slug}-w${testInfo.workerIndex}-r${testInfo.retry}@test.playaplan.local`;

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        firstName: 'Fresh',
        lastName: `W${testInfo.workerIndex}`,
        role: 'PARTICIPANT',
        isEmailVerified: true,
        // Pre-fill required profile fields so the registration step-1 hydration
        // race is avoided for fresh-user-driven specs.
        phone: '555-0100',
        emergencyContact: 'E2E Auto, 555-0199, friend',
      },
      update: {},
    });

    await loginViaUi(page, email);

    await use({
      id: user.id,
      email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    // Cleanup happens in globalTeardown via TEST_EMAIL_PREFIX matching.
  },
});

export { expect } from '@playwright/test';
