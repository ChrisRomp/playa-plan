import { test, expect } from '@playwright/test';
import { WEB_BASE_URL } from '../helpers/env';
import { testEmail } from '../helpers/runId';

test.describe('Admin: user management', { tag: ['@admin', '@admin-users'] }, () => {
  test.use({ storageState: 'tests/.auth/admin.json' });

  test('lists users and finds a persona via search', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/admin/users`);
    await expect(page.getByRole('heading', { name: /user management|users/i }).first()).toBeVisible();

    // Search for the seeded admin persona by email fragment.
    await page.getByPlaceholder(/search users/i).fill('e2e-staff');
    await expect(page.getByText('e2e-staff@test.playaplan.local')).toBeVisible({ timeout: 5_000 });
  });

  test('creates, edits, and deletes a user via the admin form', async ({ page }) => {
    const email = testEmail('admin-crud');
    await page.goto(`${WEB_BASE_URL}/admin/users`);

    // --- Create ---
    await page.getByRole('button', { name: /add user/i }).click();
    await page.locator('#email').fill(email);
    await page.locator('#firstName').fill('E2E');
    await page.locator('#lastName').fill('CRUD');
    // Default role is PARTICIPANT; submit.
    await page.getByRole('button', { name: /^(save|create)/i }).first().click();

    // Wait for the new user to appear in the list.
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });

    // --- Edit (click the row to load the form, change playa name) ---
    await page.locator('li', { hasText: email }).click();
    const playaName = `Admin-Edit-${Date.now().toString(36)}`;
    await page.locator('#playaName').fill(playaName);
    await page.getByRole('button', { name: /^(save|update)/i }).first().click();

    // The list re-renders; confirm the playa name is shown alongside the user.
    await expect(page.getByText(new RegExp(playaName))).toBeVisible({ timeout: 10_000 });

    // --- Delete (button has aria-label "Delete user E2E CRUD") ---
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /^delete user e2e crud/i }).click();

    // Modal-based delete confirmation: click Confirm/Delete inside the modal.
    const confirm = page.getByRole('button', { name: /^(confirm|delete|yes)/i }).first();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }

    await expect(page.getByText(email)).toBeHidden({ timeout: 10_000 });
  });
});

test.describe('Admin users: RBAC', { tag: ['@admin', '@admin-users', '@rbac'] }, () => {
  test.use({ storageState: 'tests/.auth/participant.json' });

  test('participant cannot reach /admin/users', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/admin/users`);
    // Either redirected away or shown access denied — both acceptable.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    const url = page.url();
    if (url.includes('/admin/users')) {
      await expect(page.getByText(/access denied|not authorized/i)).toBeVisible({ timeout: 5_000 });
    } else {
      expect(url).not.toContain('/admin/users');
    }
  });
});
