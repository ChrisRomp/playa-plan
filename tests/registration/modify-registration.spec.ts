/**
 * Coverage:
 *  - A user who already has a registration this year cannot start another one
 *    via /registration; the app shows a "Registration Not Available" notice or
 *    redirects to /dashboard.
 *
 * NOTE: As of this writing, the user-facing UI does not expose self-service
 * editing of an existing registration (job add/remove). Those changes live in
 * the admin flow, which is covered by tests/admin/registrations.spec.ts.
 */
import { test, expect } from '../helpers/fixtures';
import { webUrl } from '../helpers/env';
import { walkRegistrationToPayment } from '../helpers/registration';
import { payViaStripeCheckout } from '../helpers/stripe';

test.describe(
  'Registration: cannot re-register same year',
  { tag: ['@registration', '@slow'] },
  () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('second visit to /registration after success surfaces a not-available state', async ({
      page,
      freshParticipant,
    }) => {
      test.setTimeout(120_000);
      // Side-effect of requesting the fixture: page is logged in as freshParticipant.
      expect(freshParticipant.email).toContain('@test.playaplan.local');

      // First registration (paid).
      await walkRegistrationToPayment(page);
      await page.getByRole('button', { name: /Complete Registration/ }).click();
      await payViaStripeCheckout(page, { card: 'success' });
      await expect(page).toHaveURL(/#\/payment\/success/, { timeout: 30_000 });

      // Second visit: either a redirect to /dashboard or the not-available notice.
      await page.goto(webUrl('/registration'));
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

      const url = page.url();
      if (url.includes('#/dashboard')) {
        // App chose to redirect — accept that as the not-available behavior.
        expect(url).toMatch(/#\/dashboard/);
      } else {
        await expect(
          page.getByRole('heading', { name: /registration not available/i }),
        ).toBeVisible({ timeout: 5_000 });
      }
    });
  },
);
