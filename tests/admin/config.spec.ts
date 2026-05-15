import { test, expect } from '@playwright/test';
import { WEB_BASE_URL } from '../helpers/env';

/**
 * Read-only checks for the admin config page. Mutations are intentionally avoided —
 * changing global config (Stripe keys, registration year, etc.) would break parallel
 * tests. Add a serial-mode mutation block here later if/when needed, with explicit
 * restore in afterAll.
 */
test.describe('Admin: configuration (read-only)', { tag: ['@admin', '@admin-config'] }, () => {
  test.use({ storageState: 'tests/.auth/admin.json' });

  test('configuration page loads and shows core fields', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/admin/configuration`);
    await expect(page.getByRole('heading').filter({ hasText: /config/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Sanity check that the form has the canonical Camp Name field.
    const campName = page.getByLabel(/camp name/i).first();
    await expect(campName).toBeVisible();
    await expect(campName).not.toHaveValue('');
  });
});
