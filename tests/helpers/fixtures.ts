/* eslint-disable react-hooks/rules-of-hooks -- `use()` here is the Playwright fixture callback, not a React hook. */
import { test as base } from '@playwright/test';
import { createHash } from 'node:crypto';
import { getPrisma } from './db';
import { TEST_EMAIL_PREFIX } from './runId';
import { loginViaUi } from './auth';

interface BaseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export type FreshUser = BaseUser;
export type FreshAdmin = BaseUser;

interface FreshFixtures {
  /**
   * A brand-new PARTICIPANT user created per-test, with the page already
   * logged in. The email uses the run-id + role + a hash of the test identity
   * so it's unique across parallel workers, retries, and parallel CI runs,
   * while staying well under RFC 5321's 64-char local-part limit.
   *
   * Cleanup is automatic via the run-id prefix picked up by globalTeardown.
   */
  freshParticipant: FreshUser;
  /** Same as freshParticipant but with role=ADMIN. */
  freshAdmin: FreshAdmin;
}

interface CreateOpts {
  role: 'PARTICIPANT' | 'STAFF' | 'ADMIN';
  scope: string;
  workerIndex: number;
  retry: number;
  firstName?: string;
  lastName?: string;
}

async function createAndLogin(page: import('@playwright/test').Page, opts: CreateOpts): Promise<BaseUser> {
  const prisma = getPrisma();
  // Hash the verbose test identity into a short, stable suffix. 8 hex chars
  // gives ~4 billion buckets — more than enough across a single run, far less
  // than the 254-char (or 64-char local-part) email limit.
  const id = createHash('sha1')
    .update(`${opts.scope}|w${opts.workerIndex}|r${opts.retry}`)
    .digest('hex')
    .slice(0, 10);
  const roleTag = opts.role === 'PARTICIPANT' ? 'p' : opts.role === 'ADMIN' ? 'a' : 's';
  const email = `${TEST_EMAIL_PREFIX}-${roleTag}${id}@test.playaplan.local`;

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      firstName: opts.firstName ?? 'Fresh',
      lastName: opts.lastName ?? `W${opts.workerIndex}`,
      role: opts.role,
      isEmailVerified: true,
      phone: '555-0100',
      emergencyContact: 'E2E Auto, 555-0199, friend',
    },
    // Reset role/flags on retry so a stale user from a previous attempt can't
    // poison the test (e.g. an admin retry shouldn't get a stuck PARTICIPANT row).
    update: {
      role: opts.role,
      isEmailVerified: true,
    },
  });

  await loginViaUi(page, email);

  return {
    id: user.id,
    email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export const test = base.extend<FreshFixtures>({
  freshParticipant: async ({ page }, use, testInfo) => {
    const user = await createAndLogin(page, {
      role: 'PARTICIPANT',
      scope: `${testInfo.file}:${testInfo.title}`,
      workerIndex: testInfo.workerIndex,
      retry: testInfo.retry,
    });
    await use(user);
  },
  freshAdmin: async ({ page }, use, testInfo) => {
    const user = await createAndLogin(page, {
      role: 'ADMIN',
      scope: `${testInfo.file}:${testInfo.title}`,
      workerIndex: testInfo.workerIndex,
      retry: testInfo.retry,
    });
    await use(user);
  },
});

export { expect } from '@playwright/test';
