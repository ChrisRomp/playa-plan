import { test, expect } from '@playwright/test';
import { WEB_BASE_URL } from '../helpers/env';

test.describe('Profile page', { tag: ['@profile'] }, () => {
  // Run as the participant persona; profile edits don't affect other tests.
  test.use({ storageState: 'tests/.auth/participant.json' });

  test('renders profile form populated from the persona', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/profile`);
    await expect(page.getByRole('heading', { name: /your profile/i })).toBeVisible();

    // The form uses stable input IDs (firstName, lastName, email, etc.).
    await expect(page.locator('#firstName')).toBeVisible();
    await expect(page.locator('#lastName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();

    // Email is the persona's; first/last seeded via seed.e2e.ts.
    await expect(page.locator('#email')).toHaveValue('e2e-participant@test.playaplan.local');
  });

  test('updates editable fields and persists them', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/profile`);

    const playaName = `PlayaTest-${Date.now().toString(36)}`;
    const phone = '555-0100';
    const emergency = 'E2E Contact 555-0199';

    await page.locator('#playaName').fill(playaName);
    await page.locator('#phone').fill(phone);
    await page.locator('#emergencyContact').fill(emergency);

    await page.getByRole('button', { name: /save|update/i }).first().click();

    // ProfileForm navigates to /dashboard on successful save.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Reload the profile and confirm persistence.
    await page.goto(`${WEB_BASE_URL}/profile`);
    await expect(page.locator('#playaName')).toHaveValue(playaName);
    await expect(page.locator('#phone')).toHaveValue(phone);
    await expect(page.locator('#emergencyContact')).toHaveValue(emergency);
  });

  test('blocks save when a required field is missing', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/profile`);

    // Clear a required field and try to submit.
    await page.locator('#firstName').fill('');
    await page.getByRole('button', { name: /save|update/i }).first().click();

    // ProfileForm focuses the first missing field and does NOT navigate away.
    await expect(page).toHaveURL(/\/profile/, { timeout: 5_000 });
    await expect(page.locator('#firstName')).toBeFocused();
  });
});
