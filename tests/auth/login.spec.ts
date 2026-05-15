import { test, expect } from '@playwright/test';
import { webUrl, DEV_LOGIN_CODE } from '../helpers/env';
import { testEmail } from '../helpers/runId';

test.describe('Auth: email-code login', { tag: ['@auth'] }, () => {
  // These tests start unauthenticated regardless of the setup project's storage state.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('new user can sign up via email-code flow', async ({ page }) => {
    const email = testEmail('signup');

    await page.goto(webUrl('/login'));
    await page.evaluate(() => window.localStorage.removeItem('pendingLoginEmail'));
    await page.goto(webUrl('/login'));

    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /send verification code/i }).click();

    await expect(page.getByLabel(/verification code/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/verification code/i).fill(DEV_LOGIN_CODE);
    await page.getByRole('button', { name: /^log in$/i }).click();

    await expect(page).toHaveURL(/#\/dashboard/, { timeout: 15_000 });
  });

  test('rejects an invalid email format before sending', async ({ page }) => {
    await page.goto(webUrl('/login'));
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: /send verification code/i }).click();
    // Browser-native email validation prevents submission; we should still be on /#/login
    // and not advance to the code input.
    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByLabel(/verification code/i)).toHaveCount(0);
  });

  test('wrong code shows an error and allows retry', async ({ page }) => {
    const email = testEmail('wrong-code');
    await page.goto(webUrl('/login'));
    await page.evaluate(() => window.localStorage.removeItem('pendingLoginEmail'));
    await page.goto(webUrl('/login'));

    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /send verification code/i }).click();
    await expect(page.getByLabel(/verification code/i)).toBeVisible();

    await page.getByLabel(/verification code/i).fill('000000');
    await page.getByRole('button', { name: /^log in$/i }).click();

    // Should remain on /#/login and show an error region.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/#\/login/);

    // Retry with the correct code succeeds.
    await page.getByLabel(/verification code/i).fill(DEV_LOGIN_CODE);
    await page.getByRole('button', { name: /^log in$/i }).click();
    await expect(page).toHaveURL(/#\/dashboard/, { timeout: 15_000 });
  });

  test('protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto(webUrl('/dashboard'));
    await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
  });
});

test.describe('Auth: sign-out', { tag: ['@auth'] }, () => {
  // Use the participant storage state so we start logged in.
  test.use({ storageState: 'tests/.auth/participant.json' });

  test('sign-out clears the session and redirects', async ({ page }) => {
    await page.goto(webUrl('/dashboard'));
    await expect(page).toHaveURL(/#\/dashboard/);

    const signOut = page.getByRole('button', { name: /sign out/i });
    await expect(signOut).toBeVisible();
    await signOut.click();

    // Visiting a protected route now should bounce to login.
    await page.goto(webUrl('/dashboard'));
    await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
  });
});
