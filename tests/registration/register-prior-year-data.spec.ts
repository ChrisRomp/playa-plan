/**
 * Verifies that prior-year registration data does not incorrectly affect
 * current-year capacity calculations. Covers the bug where registrations
 * from a previous year caused jobs to appear full and new registrations
 * to be marked WAITLISTED even though the job had capacity for the
 * current year.
 *
 * Depends on seed.e2e.ts having created a prior-year CONFIRMED registration
 * on a 1-capacity job for the admin persona.
 */
import { test, expect } from '../helpers/fixtures';
import { createAuthedApiClient, ApiClient } from '../helpers/api';
import { getPrisma } from '../helpers/db';

test.describe(
  'Registration: prior-year data does not block current-year capacity',
  { tag: ['@registration', '@capacity'] },
  () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('jobs API reports correct availability when prior-year registration exists', async () => {
      const prisma = getPrisma();

      // Find the job that has the prior-year registration from seed.e2e.ts
      const config = await prisma.coreConfig.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      expect(config).not.toBeNull();
      const currentYear = config!.registrationYear;
      const priorYear = currentYear - 1;

      // Find a job with maxRegistrations=1 that has a prior-year registration
      const jobWithPriorYearReg = await prisma.job.findFirst({
        where: {
          maxRegistrations: 1,
          category: { staffOnly: false },
          registrations: {
            some: {
              registration: {
                year: priorYear,
                status: 'CONFIRMED',
              },
            },
          },
        },
      });
      expect(jobWithPriorYearReg).not.toBeNull();

      // Authenticate as a staff user and call the jobs endpoint
      const api: ApiClient = await createAuthedApiClient(
        'e2e-staff@test.playaplan.local',
      );

      try {
        const res = await api.context.get('/jobs');
        expect(res.ok()).toBeTruthy();

        const jobs = (await res.json()) as Array<{
          id: string;
          currentRegistrations: number;
          maxRegistrations: number;
        }>;

        const targetJob = jobs.find((j) => j.id === jobWithPriorYearReg!.id);
        expect(targetJob).toBeDefined();

        // The job should show 0 current registrations for the current year,
        // despite having a prior-year registration
        const currentYearRegs = await prisma.registrationJob.count({
          where: {
            jobId: jobWithPriorYearReg!.id,
            registration: {
              year: currentYear,
              status: { not: 'CANCELLED' },
            },
          },
        });
        expect(targetJob!.currentRegistrations).toBe(currentYearRegs);
        expect(targetJob!.currentRegistrations).toBeLessThan(targetJob!.maxRegistrations);
      } finally {
        await api.dispose();
      }
    });

    test('participant can register for a job that was full only in a prior year', async ({
      freshParticipant,
    }) => {
      const prisma = getPrisma();
      const config = await prisma.coreConfig.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      expect(config).not.toBeNull();
      const currentYear = config!.registrationYear;
      const priorYear = currentYear - 1;

      // Find a 1-capacity non-staff job with a prior-year registration
      const targetJob = await prisma.job.findFirst({
        where: {
          maxRegistrations: 1,
          category: { staffOnly: false },
          registrations: {
            some: {
              registration: {
                year: priorYear,
                status: 'CONFIRMED',
              },
            },
          },
        },
      });
      expect(targetJob).not.toBeNull();

      // Verify no current-year registration for this job
      const currentYearRegs = await prisma.registrationJob.count({
        where: {
          jobId: targetJob!.id,
          registration: {
            year: currentYear,
            status: { not: 'CANCELLED' },
          },
        },
      });
      expect(currentYearRegs).toBe(0);

      // Also pick a high-capacity job for the "Teardown" category requirement
      const teardownJob = await prisma.job.findFirst({
        where: { maxRegistrations: { gte: 20 } },
      });
      expect(teardownJob).not.toBeNull();

      // Register the fresh participant via the API
      const api: ApiClient = await createAuthedApiClient(freshParticipant.email);

      try {
        const res = await api.context.post('/registrations/camp', {
          data: {
            acceptedTerms: true,
            jobs: [targetJob!.id, teardownJob!.id],
            campingOptions: [],
          },
        });

        expect(res.ok()).toBeTruthy();

        // Verify the registration was created with PENDING status (not WAITLISTED)
        const reg = await prisma.registration.findFirst({
          where: {
            userId: freshParticipant.id,
            year: currentYear,
          },
        });
        expect(reg).not.toBeNull();
        expect(reg!.status).toBe('PENDING');
      } finally {
        await api.dispose();
      }
    });
  },
);
