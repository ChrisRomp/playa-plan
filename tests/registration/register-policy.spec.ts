/**
 * Server-side policy enforcement for POST /registrations/camp.
 *
 * Covers issues #158 / #159 / #160 for the cases that can be exercised
 * without mutating the shared `coreConfig` row (which would race other
 * parallel specs). The window-based checks
 * (`registrationOpen`/`earlyRegistrationOpen` × `allowEarlyRegistration`)
 * are fully covered by the policy-service unit tests in
 * `apps/api/src/registrations/services/registration-policy.service.spec.ts`.
 *
 * Success cases for the deferred path live in `register-deferred.spec.ts`.
 */
import { test, expect } from '../helpers/fixtures';
import { createAuthedApiClient } from '../helpers/api';
import { getPrisma } from '../helpers/db';

test.describe(
  'Registration: server-side policy',
  { tag: ['@registration', '@policy'] },
  () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    /**
     * Helper: find a real campingOption id (created by seed.ts) and a real
     * job id (so the registration would otherwise succeed and the only
     * thing left to reject is the policy gate).
     */
    async function findSeededIds(): Promise<{ campingOptionId: string; jobId: string }> {
      const prisma = getPrisma();
      const option = await prisma.campingOption.findFirst({ where: { enabled: true } });
      const job = await prisma.job.findFirst();
      if (!option || !job) {
        throw new Error('Seed data missing: need at least one camping option and one job');
      }
      return { campingOptionId: option.id, jobId: job.id };
    }

    test(
      'rejects POST /registrations/camp when user.allowRegistration=false',
      async ({ freshDisabledParticipant }) => {
        const { campingOptionId, jobId } = await findSeededIds();
        const api = await createAuthedApiClient(freshDisabledParticipant.email);
        try {
          const res = await api.context.post('/registrations/camp', {
            data: {
              campingOptions: [campingOptionId],
              jobs: [jobId],
              acceptedTerms: true,
            },
          });
          expect(res.status()).toBe(403);
          const body = await res.json();
          expect(JSON.stringify(body)).toMatch(/not available for your account/i);
        } finally {
          await api.dispose();
        }
      },
    );

    test(
      'rejects POST /registrations/camp when user.allowNoJob=false and jobs is empty',
      async ({ freshParticipant }) => {
        const { campingOptionId } = await findSeededIds();
        const api = await createAuthedApiClient(freshParticipant.email);
        try {
          const res = await api.context.post('/registrations/camp', {
            data: {
              campingOptions: [campingOptionId],
              jobs: [],
              acceptedTerms: true,
            },
          });
          expect(res.status()).toBe(400);
          const body = await res.json();
          expect(JSON.stringify(body)).toMatch(/at least one work shift/i);
        } finally {
          await api.dispose();
        }
      },
    );

    test(
      'allows POST /registrations/camp with empty jobs when user.allowNoJob=true',
      async ({ freshNoJobParticipant }) => {
        const { campingOptionId } = await findSeededIds();
        const api = await createAuthedApiClient(freshNoJobParticipant.email);
        try {
          const res = await api.context.post('/registrations/camp', {
            data: {
              campingOptions: [campingOptionId],
              jobs: [],
              acceptedTerms: true,
            },
          });
          expect(res.status()).toBeGreaterThanOrEqual(200);
          expect(res.status()).toBeLessThan(300);

          // The new behavior is "always create a Registration row, even with
          // no jobs" — verify the row exists and renders with jobs: [].
          const prisma = getPrisma();
          const reg = await prisma.registration.findFirst({
            where: { userId: freshNoJobParticipant.id },
            include: { jobs: true },
            orderBy: { createdAt: 'desc' },
          });
          expect(reg).not.toBeNull();
          expect(reg!.jobs).toEqual([]);
        } finally {
          await api.dispose();
        }
      },
    );

    test(
      'rejects POST /registrations/camp with deferPayment=true when user is not eligible to defer',
      async ({ freshParticipant }) => {
        const { campingOptionId, jobId } = await findSeededIds();
        const api = await createAuthedApiClient(freshParticipant.email);
        try {
          const res = await api.context.post('/registrations/camp', {
            data: {
              campingOptions: [campingOptionId],
              jobs: [jobId],
              acceptedTerms: true,
              deferPayment: true,
            },
          });
          expect(res.status()).toBe(403);
          const body = await res.json();
          expect(JSON.stringify(body)).toMatch(/not eligible to defer/i);
        } finally {
          await api.dispose();
        }
      },
    );
  },
);
