import { Page, expect } from '@playwright/test';
import { WEB_BASE_URL, DEV_LOGIN_CODE } from './env';

/**
 * Drive the LoginForm UI to sign a user in. Used by the storage-state setup project
 * and by any spec that needs to assert UI login behavior. For tests that just need
 * an authenticated session, prefer the storage-state file produced by auth.setup.ts.
 */
export async function loginViaUi(page: Page, email: string): Promise<void> {
  // localStorage may carry a stale pendingLoginEmail from a previous run — clear it.
  await page.goto(`${WEB_BASE_URL}/login`);
  await page.evaluate(() => {
    try {
      window.localStorage.removeItem('pendingLoginEmail');
    } catch {
      /* ignore */
    }
  });
  await page.goto(`${WEB_BASE_URL}/login`);

  await page.locator('input[type="email"]').fill(email);
  await page.locator('button[type="submit"]:has-text("Send Verification Code")').click();

  const codeInput = page.locator('input#verificationCode');
  await expect(codeInput).toBeVisible({ timeout: 10_000 });

  await codeInput.fill(DEV_LOGIN_CODE);
  await page.locator('button[type="submit"]').last().click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

export async function logoutViaUi(page: Page): Promise<void> {
  const signOut = page.getByRole('button', { name: /sign out/i });
  if (await signOut.isVisible().catch(() => false)) {
    await signOut.click();
  }
}
