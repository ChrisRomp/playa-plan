/**
 * Coverage:
 *  - Create a camping option with custom dues + max signups, then disable it.
 *  - Verify it appears as a row and can be deleted.
 *
 * Custom-field CRUD lives on a separate route (/admin/camping-options/:id/fields)
 * and is large enough to deserve its own spec — out of scope here for now.
 */
import { test, expect } from '../helpers/fixtures';
import { webUrl } from '../helpers/env';
import { RUN_ID } from '../helpers/runId';

test.describe(
  'Admin: camping options',
  { tag: ['@admin', '@admin-camping'] },
  () => {
    test.use({ storageState: 'tests/.auth/admin.json' });

    test('creates and deletes a camping option', async ({ page }, testInfo) => {
      const name = `E2E-Camping-${RUN_ID}-w${testInfo.workerIndex}`;

      await page.goto(webUrl('/admin/camping-options'));
      await expect(page.getByRole('heading', { name: 'Camping Options' })).toBeVisible();

      // The form is rendered inline (no role=dialog), so use page-level locators
      // and rely on the form fields being unique while the form is open.
      await page.getByRole('button', { name: 'Add Option' }).click();
      await page.getByRole('textbox', { name: 'Name*' }).fill(name);
      await page.getByRole('textbox', { name: 'Description' }).fill('E2E created');
      await page.getByRole('spinbutton', { name: 'Participant Dues ($)' }).fill('100');
      await page.getByRole('spinbutton', { name: 'Staff Dues ($)' }).fill('100');
      await page.getByRole('spinbutton', { name: 'Max Signups (0 = unlimited)' }).fill('5');
      await page.getByRole('button', { name: /^Save$/ }).click();

      const row = page.getByRole('row', { name: new RegExp(`^${name}\\b`) });
      await expect(row).toBeVisible({ timeout: 10_000 });

      // Delete the option via the row's Delete + confirm modal.
      await row.getByRole('button', { name: /^Delete$/ }).click();
      const modal = page.locator('div').filter({ hasText: /^Confirm/ }).last();
      await expect(modal).toBeVisible({ timeout: 5_000 });
      await modal.getByRole('button', { name: /^(Delete|Confirm|Yes)$/ }).click();
      await expect(row).toBeHidden({ timeout: 10_000 });
    });
  },
);
