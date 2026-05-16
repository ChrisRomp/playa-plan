/**
 * Coverage:
 *  - Payment Reports page loads with the expected heading, filter toggle, and
 *    export button.
 *
 * Manual payment recording, refunds, and provider/status filters live in their
 * own admin-flow components and are large enough to deserve dedicated specs —
 * out of scope here for now.
 */
import { test, expect } from '../helpers/fixtures';
import { webUrl } from '../helpers/env';

test.describe(
  'Admin: payments report',
  { tag: ['@admin', '@admin-payments', '@payment'] },
  () => {
    test.use({ storageState: 'tests/.auth/admin.json' });

    test('payment reports page loads with controls', async ({ page }) => {
      await page.goto(webUrl('/reports/payments'));
      await expect(page.getByRole('heading', { name: 'Payment Reports' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole('button', { name: 'Toggle filters' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export payments data' })).toBeVisible();
    });
  },
);
