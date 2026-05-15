import { test, expect } from '@playwright/test';
import { WEB_BASE_URL, DEV_LOGIN_CODE } from '../helpers/env';
import { testEmail } from '../helpers/runId';

test.describe('Auth: email-code login', { tag: ['@auth'] }, () => {
  // These tests start unauthenticated regardless of the setup project's storage state.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('new user can sign up via email-code flow', async ({ page }) => {
    const email = testEmail('signup');

    await page.goto(`${WEB_BASE_URL}/login`);
    await page.evaluate(() => window.localStorage.removeItem('pendingLoginEmail'));
    await page.goto(`${WEB_BASE_URL}/login`);

    await page.locator('input[type="email"]').fill(email);
    await page.getByRole('button', { name: /send verification code/i }).click();

    await expect(page.locator('input#verificationCode')).toBeVisible({ timeout: 10_000 });
    await page.locator('input#verificationCode').fill(DEV_LOGIN_CODE);
    await page.getByRole('button', { name: /^log in$/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test('rejects an invalid email format before sending', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/login`);
    await page.locator('input[type="email"]').fill('not-an-email');
    await page.getByRole('button', { name: /send verification code/i }).click();
    // Browser-native email validation prevents submission; we should still be on /login
    // and not advance to the code input.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input#verificationCode')).toHaveCount(0);
  });

  test('wrong code shows an error and allows retry', async ({ page }) => {
    const email = testEmail('wrong-code');
    await page.goto(`${WEB_BASE_URL}/login`);
    await page.evaluate(() => window.localStorage.removeItem('pendingLoginEmail'));
    await page.goto(`${WEB_BASE_URL}/login`);

    await page.locator('input[type="email"]').fill(email);
    await page.getByRole('button', { name: /send verification code/i }).click();
    await expect(page.locator('input#verificationCode')).toBeVisible();

    await page.locator('input#verificationCode').fill('000000');
    await page.getByRole('button', { name: /^log in$/i }).click();

    // Should remain on /login and show an error region.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    // Retry with the correct code succeeds.
    await page.locator('input#verificationCode').fill(DEV_LOGIN_CODE);
    await page.getByRole('button', { name: /^log in$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test('protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

test.describe('Auth: sign-out', { tag: ['@auth'] }, () => {
  // Use the participant storage state so we start logged in.
  test.use({ storageState: 'tests/.auth/participant.json' });

  test('sign-out clears the session and redirects', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/dashboard/);

    const signOut = page.getByRole('button', { name: /sign out/i });
    await expect(signOut).toBeVisible();
    await signOut.click();

    // Visiting a protected route now should bounce to login.
    await page.goto(`${WEB_BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
