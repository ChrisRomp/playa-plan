/**
 * Coverage:
 *  - End-to-end deferred-dues path: a participant with allowDeferredDuesPayment
 *    set both at config and user level should see "Pay Dues Later" instead of
 *    Stripe Checkout, complete registration without paying, and land on the
 *    dashboard with a PENDING registration and no completed payment.
 *
 * Note on status: the registration is created by `createCampRegistration`
 * which calls `create()` with the user's chosen jobs. That sets the row to
 * PENDING (or WAITLISTED if a chosen job is full); the only path that today
 * transitions a registration to CONFIRMED is a successful payment in
 * `payments.service.ts`. Server-side promotion of deferred registrations is
 * tracked as a separate follow-up to issue #154.
 */
import { test, expect } from '../helpers/fixtures';
import { walkRegistrationToPayment } from '../helpers/registration';
import { getPrisma } from '../helpers/db';

test.describe(
  'Registration: deferred dues',
  { tag: ['@registration', '@deferred'] },
  () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test(
      'deferred-payment participant completes registration without paying',
      async ({ page, freshDeferredParticipant }) => {
        test.setTimeout(60_000);
        await walkRegistrationToPayment(page);

        await expect(
          page.getByText(/payment has been deferred|complete payment later/i),
        ).toBeVisible();
        const payLater = page.getByRole('button', { name: /pay dues later/i });
        await expect(payLater).toBeVisible();
        await payLater.click();

        await expect(page).toHaveURL(/#\/dashboard/, { timeout: 15_000 });

        const prisma = getPrisma();
        const reg = await prisma.registration.findFirst({
          where: { userId: freshDeferredParticipant.id },
          include: { payments: true, jobs: true },
          orderBy: { createdAt: 'desc' },
        });
        expect(reg).not.toBeNull();
        expect(reg!.status).toBe('PENDING');
        expect(reg!.year).toBe(new Date().getFullYear());
        expect(reg!.jobs.length).toBeGreaterThanOrEqual(2);
        const completed = reg!.payments.filter((p) => p.status === 'COMPLETED');
        expect(completed).toHaveLength(0);
      },
    );
  },
);
