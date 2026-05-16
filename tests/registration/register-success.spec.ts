/**
 * Full happy-path registration through Stripe success card. Asserts:
 *  - Profile → Options → Details → Shifts → Review → Payment flow completes
 *  - Stripe Checkout success redirects to /#/payment/success
 *  - Backend Registration row becomes CONFIRMED with a COMPLETED Payment
 */
import { test, expect } from '../helpers/fixtures';
import { webUrl } from '../helpers/env';
import { walkRegistrationToPayment } from '../helpers/registration';
import { payViaStripeCheckout } from '../helpers/stripe';
import { getPrisma } from '../helpers/db';

test.describe(
  'Registration: paid success (Stripe)',
  { tag: ['@registration', '@payment', '@slow'] },
  () => {
    // Each test creates its own user via the freshParticipant fixture, so they're
    // hermetic and parallel-safe — no shared-persona contention.
    test.use({ storageState: { cookies: [], origins: [] } });

    test('participant completes paid registration end-to-end', async ({
      page,
      freshParticipant,
    }) => {
      test.setTimeout(120_000);

      await walkRegistrationToPayment(page);

      await page.getByRole('button', { name: /Complete Registration/ }).click();

      await payViaStripeCheckout(page, { card: 'success' });

      await expect(page).toHaveURL(/#\/payment\/success/, { timeout: 30_000 });
      await expect(
        page.getByRole('heading', { name: /payment successful/i }),
      ).toBeVisible({ timeout: 10_000 });

      // Verify backend state for THIS user (not a shared persona).
      const prisma = getPrisma();
      const reg = await prisma.registration.findFirst({
        where: { userId: freshParticipant.id },
        include: { payments: true, jobs: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(reg).not.toBeNull();
      expect(reg!.status).toBe('CONFIRMED');
      expect(reg!.year).toBe(new Date().getFullYear());
      expect(reg!.jobs.length).toBeGreaterThanOrEqual(2);
      expect(reg!.payments.length).toBeGreaterThanOrEqual(1);
      const payment = reg!.payments[0];
      expect(payment.status).toBe('COMPLETED');
      expect(payment.provider).toBe('STRIPE');
      expect(payment.amount).toBeGreaterThan(0);

      // Dashboard reflects the registered state for this user.
      await page.goto(webUrl('/dashboard'));
      await expect(page.getByRole('heading', { name: /current registration/i })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole('link', { name: /start registration/i })).toBeHidden();
    });
  },
);
