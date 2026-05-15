/**
 * Thin Prisma client for tests. Use sparingly — prefer the API client.
 *
 * Safety rails: write operations exposed here only delete rows whose email/userId
 * matches the current run's TEST_EMAIL_PREFIX. This keeps a misconfigured local run
 * from nuking data in a shared dev DB.
 */
import { PrismaClient } from '@prisma/client';
import { DATABASE_URL } from './env';
import { TEST_EMAIL_PREFIX } from './runId';

let cached: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!cached) {
    cached = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  }
  return cached;
}

export async function disconnectPrisma(): Promise<void> {
  if (cached) {
    await cached.$disconnect();
    cached = null;
  }
}

/**
 * Best-effort cleanup of any rows tagged with the current run's prefix, plus any
 * registrations/payments owned by the canonical e2e- personas (so a previous run's
 * leftover registration doesn't make a "fresh" registration test fail).
 *
 * Logs and continues on errors; never throws.
 */
export async function cleanupRunData(): Promise<void> {
  const prisma = getPrisma();
  const prefix = `${TEST_EMAIL_PREFIX}-`;

  try {
    // Per-run users we will delete entirely.
    const runUsers = await prisma.user.findMany({
      where: { email: { startsWith: prefix } },
      select: { id: true },
    });

    // Canonical personas — we keep the user rows but blow away their
    // registration/payment data so each run starts clean.
    const personaUsers = await prisma.user.findMany({
      where: { email: { endsWith: '@test.playaplan.local' } },
      select: { id: true },
    });

    const runUserIds = runUsers.map((u) => u.id);
    const personaUserIds = personaUsers.map((u) => u.id);
    const allUserIds = Array.from(new Set([...runUserIds, ...personaUserIds]));
    if (allUserIds.length === 0) return;

    // Delete in FK-safe order. Each step is wrapped so a single failure doesn't
    // abort the rest of the cleanup.
    const steps: Array<[string, () => Promise<unknown>]> = [
      ['email_audit', () => prisma.emailAudit.deleteMany({ where: { userId: { in: allUserIds } } })],
      ['notifications', () => prisma.notification.deleteMany({ where: { recipient: { startsWith: prefix } } })],
      ['admin_audit', () => prisma.adminAudit.deleteMany({ where: { adminUserId: { in: allUserIds } } })],
      ['payments', () => prisma.payment.deleteMany({ where: { userId: { in: allUserIds } } })],
      ['registration_jobs', () =>
        prisma.registrationJob.deleteMany({
          where: { registration: { userId: { in: allUserIds } } },
        }),
      ],
      ['camping_option_field_values', () =>
        prisma.campingOptionFieldValue.deleteMany({
          where: { registration: { userId: { in: allUserIds } } },
        }),
      ],
      ['camping_option_registrations', () =>
        prisma.campingOptionRegistration.deleteMany({ where: { userId: { in: allUserIds } } }),
      ],
      ['registrations', () => prisma.registration.deleteMany({ where: { userId: { in: allUserIds } } })],
      // Only delete users + passkeys + challenges for run-prefixed users.
      ['passkeys', () => prisma.passkey.deleteMany({ where: { userId: { in: runUserIds } } })],
      ['webauthn_challenges', () => prisma.webAuthnChallenge.deleteMany({ where: { userId: { in: runUserIds } } })],
      ['users', () => prisma.user.deleteMany({ where: { id: { in: runUserIds } } })],
    ];

    for (const [label, fn] of steps) {
      try {
        const result = (await fn()) as { count?: number } | unknown;
        const count = (result as { count?: number })?.count ?? 0;
        if (count > 0) {
          console.log(`[e2e-cleanup] ${label}: deleted ${count} rows`);
        }
      } catch (err) {
        console.warn(`[e2e-cleanup] ${label}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    console.warn(`[e2e-cleanup] aborted: ${(err as Error).message}`);
  }
}
