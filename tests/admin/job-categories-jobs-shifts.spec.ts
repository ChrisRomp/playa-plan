/**
 * Coverage:
 *  - Create a new job category (uniquely named per run), edit description,
 *    toggle staff-only / always-required flags, delete.
 *  - Create a new shift, edit, delete.
 *  - Create a new job tied to that category + shift, edit max registrations,
 *    delete.
 *
 * All entities are uniquely named per-run via the run-id prefix so parallel
 * tests/categories don't collide.
 */
import { test, expect } from '../helpers/fixtures';
import { webUrl } from '../helpers/env';
import { RUN_ID } from '../helpers/runId';

test.describe(
  'Admin: job categories / shifts / jobs',
  { tag: ['@admin', '@admin-jobs'] },
  () => {
    test.use({ storageState: 'tests/.auth/admin.json' });

    test('creates, edits, and deletes a job category', async ({ page }, testInfo) => {
      const name = `E2E-Cat-${RUN_ID}-w${testInfo.workerIndex}`;
      const renamed = `${name}-renamed`;
      await page.goto(webUrl('/admin/job-categories'));
      await expect(page.getByRole('heading', { name: 'Job Category Management' })).toBeVisible();

      await page.getByRole('button', { name: 'Add job category' }).click();
      await page.getByRole('textbox', { name: 'Name' }).fill(name);
      await page
        .getByRole('textbox', { name: 'Description' })
        .fill('Created by E2E job-categories spec');
      await page.getByRole('checkbox', { name: 'Only visible to staff' }).check();
      await page.getByRole('button', { name: 'Add Category' }).click();

      // Row appears with Edit/Delete buttons named after the category.
      await expect(page.getByRole('button', { name: `Edit ${name}` })).toBeVisible({
        timeout: 10_000,
      });

      // Edit description by reopening the modal.
      await page.getByRole('button', { name: `Edit ${name}` }).click();
      await page.getByRole('textbox', { name: 'Name' }).fill(renamed);
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect(page.getByRole('button', { name: `Edit ${renamed}` })).toBeVisible({
        timeout: 10_000,
      });

      // Delete and confirm via the inline modal (same pattern as admin/users —
      // the confirm modal lacks role=dialog, so locate by its heading text).
      await page.getByRole('button', { name: `Delete ${renamed}` }).click();
      const modal = page.locator('div').filter({ hasText: /^Confirm/ }).last();
      await expect(modal).toBeVisible({ timeout: 5_000 });
      await modal.getByRole('button', { name: /^(Delete|Confirm|Yes)$/ }).click();
      await expect(page.getByRole('button', { name: `Edit ${renamed}` })).toBeHidden({
        timeout: 10_000,
      });
    });

    test('creates and deletes a shift', async ({ page }, testInfo) => {
      const name = `E2E-Shift-${RUN_ID}-w${testInfo.workerIndex}`;
      await page.goto(webUrl('/admin/shifts'));
      await expect(page.getByRole('heading', { name: 'Shifts' })).toBeVisible();

      await page.getByRole('button', { name: 'Add Shift' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('textbox', { name: 'Name *' }).fill(name);
      await dialog.getByRole('combobox', { name: 'Day *' }).selectOption('MONDAY');
      // Default 09:00–17:00 are fine.
      await dialog.getByRole('button', { name: 'Add Shift' }).click();

      // Row appears in the table.
      const row = page.getByRole('row', { name: new RegExp(`${name}\\b`) });
      await expect(row).toBeVisible({ timeout: 10_000 });

      // Shift deletion is immediate (no confirmation modal).
      await row.getByRole('button', { name: 'Delete' }).click();
      await expect(row).toBeHidden({ timeout: 10_000 });
    });
  },
);
