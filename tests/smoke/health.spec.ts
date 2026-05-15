import { test, expect } from '@playwright/test';
import { API_BASE_URL, WEB_BASE_URL } from '../helpers/env';

test.describe('Smoke: health & home', { tag: ['@smoke'] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('API /health returns ok', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/health`);
    expect(res.ok()).toBeTruthy();
  });

  test('home page renders and shows a sign-in entry point', async ({ page }) => {
    await page.goto(WEB_BASE_URL);
    // Either a "Sign In" link or a "Log In" affordance must exist when unauthenticated.
    const signIn = page.getByRole('link', { name: /sign in|log in/i }).first();
    await expect(signIn).toBeVisible({ timeout: 10_000 });
  });

  test('login route renders the login form', async ({ page }) => {
    await page.goto(`${WEB_BASE_URL}/login`);
    await expect(page.getByRole('heading', { name: /log in or sign up/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
