/**
 * Coverage:
 *  - End-to-end deferred-dues path: a participant with allowDeferredDuesPayment
 *    set both at config and user level should see "Pay Dues Later" instead of
 *    Stripe Checkout, complete registration without paying, and land on the
 *    dashboard with a CONFIRMED registration carrying paymentDeferred=true
 *    and no completed payment.
 *
 * Server semantics (post-#160): when the client sends `deferPayment: true`
 * to POST /registrations/camp and policy allows it (both coreConfig and
 * per-user flag are true), the registration is created with status =
 * CONFIRMED and paymentDeferred = true. A later successful payment via the
 * dashboard's "Pay Now" CTA clears paymentDeferred.
 */
import { test, expect } from '../helpers/fixtures';
import { walkRegistrationToPayment } from '../helpers/registration';
import { getPrisma } from '../helpers/db';
import { payViaStripeCheckout } from '../helpers/stripe';

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
        expect(reg!.status).toBe('CONFIRMED');
        expect(reg!.paymentDeferred).toBe(true);
        expect(reg!.year).toBe(new Date().getFullYear());
        expect(reg!.jobs.length).toBeGreaterThanOrEqual(2);
        const completed = reg!.payments.filter((p) => p.status === 'COMPLETED');
        expect(completed).toHaveLength(0);

        // Dashboard surfaces the deferred-payment indicator so the user
        // knows to circle back later.
        await expect(page.getByText(/payment deferred/i)).toBeVisible();
      },
    );

    test(
      'deferred participant can later complete payment, clearing paymentDeferred',
      async ({ page, freshDeferredParticipant }) => {
        test.setTimeout(120_000);

        // First, walk through registration choosing the deferred path.
        await walkRegistrationToPayment(page);
        await page.getByRole('button', { name: /pay dues later/i }).click();
        await expect(page).toHaveURL(/#\/dashboard/, { timeout: 15_000 });

        // Sanity: registration landed CONFIRMED + paymentDeferred=true.
        const prisma = getPrisma();
        const regBefore = await prisma.registration.findFirst({
          where: { userId: freshDeferredParticipant.id },
          orderBy: { createdAt: 'desc' },
        });
        expect(regBefore?.status).toBe('CONFIRMED');
        expect(regBefore?.paymentDeferred).toBe(true);

        // Dashboard should expose a Pay Now CTA for the deferred dues.
        const payNow = page.getByRole('button', { name: /pay now/i });
        await expect(payNow).toBeVisible({ timeout: 15_000 });
        await payNow.click();

        // Stripe Checkout — drop in a test card and submit. `success` is
        // the standard Stripe test-mode happy-path card from STRIPE_TEST_CARDS
        // in tests/helpers/stripe.ts.
        await payViaStripeCheckout(page, { card: 'success' });

        // After redirect back to /#/payment-success, the page calls
        // `handleStripeSuccess` which hits POST /payments/verify-stripe-session.
        // That endpoint is what flips `paymentDeferred` to false on the
        // registration. Wait for the in-page spinner to disappear before
        // reading the DB so we don't race the verification request.
        await expect(page).toHaveURL(/#\/payment(-success)?|#\/dashboard/, {
          timeout: 30_000,
        });
        await expect(page.getByText(/processing your payment/i)).toHaveCount(0, {
          timeout: 30_000,
        });

        const regAfter = await prisma.registration.findFirst({
          where: { userId: freshDeferredParticipant.id },
          include: { payments: true },
          orderBy: { createdAt: 'desc' },
        });
        expect(regAfter?.status).toBe('CONFIRMED');
        expect(regAfter?.paymentDeferred).toBe(false);
        const completed = regAfter!.payments.filter((p) => p.status === 'COMPLETED');
        expect(completed.length).toBeGreaterThanOrEqual(1);
      },
    );
  },
);
