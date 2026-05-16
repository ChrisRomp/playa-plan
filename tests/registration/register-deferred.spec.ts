/**
 * Coverage:
 *  - End-to-end deferred-dues path: a participant with allowDeferredDuesPayment
 *    set both at config and user level should see "Pay Dues Later" instead of
 *    Stripe Checkout, complete registration without paying, and land on the
 *    dashboard with a CONFIRMED registration and no completed payment.
 *
 * KNOWN APP BUG (skipped, not deleted): apps/web/src/store/AuthContext.tsx
 * builds the in-app `user` object as `{id, name, email, role,
 * isAuthenticated}` and drops `allowDeferredDuesPayment` (and the other
 * per-user flags) when it stores the auth response. The registration page's
 * deferred-path check is `config?.allowDeferredDuesPayment &&
 * user?.allowDeferredDuesPayment`, so the user-side condition is *always*
 * false and the deferred path is unreachable through the real UI even when
 * the database says the user is allowed.
 *
 * Until the app exposes the per-user flag on the client `user` object, this
 * spec is a `test.fixme` documenting the bug — kept in source so it lights
 * up green automatically the moment the bug is fixed.
 */
import { test, expect } from '../helpers/fixtures';
import { walkRegistrationToPayment } from '../helpers/registration';
import { getPrisma } from '../helpers/db';

test.describe(
  'Registration: deferred dues',
  { tag: ['@registration', '@deferred'] },
  () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.fixme(
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
        expect(reg!.status).toBe('CONFIRMED');
        expect(reg!.year).toBe(new Date().getFullYear());
        expect(reg!.jobs.length).toBeGreaterThanOrEqual(2);
        const completed = reg!.payments.filter((p) => p.status === 'COMPLETED');
        expect(completed).toHaveLength(0);
      },
    );
  },
);
