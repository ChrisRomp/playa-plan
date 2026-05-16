/**
 * Coverage:
 *  - The Manage Registrations page loads for an admin and surfaces a search
 *    affordance + the registration grid.
 *  - When a fresh participant has a registration, the admin can find it via
 *    the search box.
 *
 * Edit / cancel-with-refund / audit-trail flows are higher-cost and live in
 * separate components; they should grow as their own focused tests once the
 * supporting helpers (pre-create registration via API, drive cancel modal,
 * assert AdminAudit row) are in place.
 */
import { test, expect } from '../helpers/fixtures';
import { webUrl } from '../helpers/env';
import { walkRegistrationToPayment } from '../helpers/registration';
import { payViaStripeCheckout } from '../helpers/stripe';
import { loginViaUi, logoutViaUi } from '../helpers/auth';

test.describe(
  'Admin: manage registrations',
  { tag: ['@admin', '@admin-registrations', '@slow'] },
  () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('admin can find a fresh registration via the search box', async ({
      page,
      freshParticipant,
    }) => {
      test.setTimeout(120_000);

      // Create a registration as the participant.
      await walkRegistrationToPayment(page);
      await page.getByRole('button', { name: /Complete Registration/ }).click();
      await payViaStripeCheckout(page, { card: 'success' });
      await expect(page).toHaveURL(/#\/payment\/success/, { timeout: 30_000 });

      // Switch to the admin persona.
      await logoutViaUi(page);
      await loginViaUi(page, 'e2e-admin@test.playaplan.local');

      await page.goto(webUrl('/admin/manage-registrations'));
      await expect(page.getByRole('heading', { name: 'Manage Registrations' })).toBeVisible({
        timeout: 10_000,
      });

      // The grid is searchable; search by the participant's email.
      const search = page.getByRole('textbox', { name: /filter table data|search/i });
      await expect(search).toBeVisible();
      await search.fill(freshParticipant.email);

      await expect(page.getByText(freshParticipant.email)).toBeVisible({ timeout: 10_000 });
    });
  },
);
