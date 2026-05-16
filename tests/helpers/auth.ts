import { Page, expect } from '@playwright/test';
import { webUrl, DEV_LOGIN_CODE } from './env';

/**
 * Drive the LoginForm UI to sign a user in. Used by the storage-state setup project
 * and by any spec that needs to assert UI login behavior. For tests that just need
 * an authenticated session, prefer the storage-state file produced by auth.setup.ts.
 */
export async function loginViaUi(page: Page, email: string): Promise<void> {
  // localStorage may carry a stale pendingLoginEmail from a previous run — clear it.
  await page.goto(webUrl('/login'));
  await page.evaluate(() => {
    try {
      window.localStorage.removeItem('pendingLoginEmail');
    } catch {
      /* ignore */
    }
  });
  await page.goto(webUrl('/login'));

  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /send verification code/i }).click();

  // Allow extra time for the form to transition under parallel load — the
  // request-login-code endpoint can take a moment when the throttler is hot.
  const codeInput = page.getByLabel(/verification code/i);
  await expect(codeInput).toBeVisible({ timeout: 20_000 });

  await codeInput.fill(DEV_LOGIN_CODE);
  await page.getByRole('button', { name: /^log in$/i }).click();

  // HashRouter — dashboard URL is .../#/dashboard.
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 15_000 });
}

export async function logoutViaUi(page: Page): Promise<void> {
  const signOut = page.getByRole('button', { name: /sign out/i });
  if (await signOut.isVisible().catch(() => false)) {
    await signOut.click();
  }
}
