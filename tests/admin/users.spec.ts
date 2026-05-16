import { test, expect } from '@playwright/test';
import { webUrl } from '../helpers/env';
import { testEmail } from '../helpers/runId';

test.describe('Admin: user management', { tag: ['@admin', '@admin-users'] }, () => {
  test.use({ storageState: 'tests/.auth/admin.json' });

  test('lists users and finds a persona via search', async ({ page }) => {
    await page.goto(webUrl('/admin/users'));
    await expect(page.getByRole('heading', { name: /user management|users/i }).first()).toBeVisible();

    // Search for the seeded staff persona by email fragment.
    await page.getByPlaceholder(/search users/i).fill('e2e-staff');
    await expect(page.getByText('e2e-staff@test.playaplan.local')).toBeVisible({ timeout: 5_000 });
  });

  test('creates, edits, and deletes a user via the admin form', async ({ page }) => {
    const email = testEmail('admin-crud');
    const firstName = 'E2E';
    // Use a unique last name so the aria-label "Delete user E2E <unique>" is precise
    // and won't collide with other tests creating similarly-named users in parallel.
    const lastName = `CRUD-${Date.now().toString(36)}`;
    const fullName = `${firstName} ${lastName}`;

    await page.goto(webUrl('/admin/users'));

    // --- Create ---
    await page.getByRole('button', { name: /add user/i }).click();
    await page.locator('#email').fill(email);
    await page.locator('#firstName').fill(firstName);
    await page.locator('#lastName').fill(lastName);
    await page.getByRole('button', { name: 'Create' }).click();

    // Wait for the new user to appear in the list.
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });

    // --- Edit (click the row to load the form, change playa name) ---
    await page.locator('li', { hasText: email }).click();
    const playaName = `Admin-Edit-${Date.now().toString(36)}`;
    await page.locator('#playaName').fill(playaName);
    await page.getByRole('button', { name: 'Update' }).click();

    // The list re-renders; confirm the playa name is shown alongside the user.
    await expect(page.getByText(new RegExp(playaName))).toBeVisible({ timeout: 10_000 });

    // --- Delete ---
    // The row's "Delete user <name>" button opens a confirm-deletion modal containing
    // its own "Delete" button. Use the modal heading to scope the inner button.
    await page.getByRole('button', { name: `Delete user ${fullName}` }).click();
    const modal = page.locator('div').filter({ hasText: /^Confirm Deletion/ }).last();
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(email)).toBeHidden({ timeout: 10_000 });
  });
});

test.describe('Admin users: RBAC', { tag: ['@admin', '@admin-users', '@rbac'] }, () => {
  test.use({ storageState: 'tests/.auth/participant.json' });

  test('participant cannot reach /admin/users', async ({ page }) => {
    await page.goto(webUrl('/admin/users'));
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    const url = page.url();
    if (url.includes('#/admin/users')) {
      await expect(page.getByText(/access denied|not authorized/i)).toBeVisible({ timeout: 5_000 });
    } else {
      expect(url).not.toContain('#/admin/users');
    }
  });
});
