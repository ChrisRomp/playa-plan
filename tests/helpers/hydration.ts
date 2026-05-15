import { Page, expect } from '@playwright/test';

/**
 * Wait for the profile/registration profile-step form to finish hydrating from the
 * API. This is a centralization of the same race fix used in profile.spec.ts and
 * registration helpers — the form's useEffect overwrites local state when the
 * profile finally arrives, so any test that fills the profile fields must wait
 * for hydration first or its writes will be silently clobbered.
 *
 * Pass `expectedEmail` when known; otherwise we just wait for #email to be non-empty.
 */
export async function waitForProfileHydrated(page: Page, expectedEmail?: string): Promise<void> {
  const email = page.locator('#email');
  if (expectedEmail) {
    await expect(email).toHaveValue(expectedEmail, { timeout: 10_000 });
  } else {
    await expect(email).not.toHaveValue('', { timeout: 10_000 });
  }
}

/**
 * Same race in the registration multi-step flow's profile step (different markup —
 * the inputs are role=textbox with names "First Name*" / "Email*" rather than the
 * `#firstName` / `#email` ID inputs used on /profile).
 */
export async function waitForRegistrationProfileHydrated(
  page: Page,
  expectedEmail?: string,
): Promise<void> {
  const email = page.getByRole('textbox', { name: 'Email*' });
  if (expectedEmail) {
    await expect(email).toHaveValue(expectedEmail, { timeout: 10_000 });
  } else {
    await expect(email).not.toHaveValue('', { timeout: 10_000 });
  }
}
