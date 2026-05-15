import { Page, expect } from '@playwright/test';
import { webUrl } from './env';

/**
 * Walk a logged-in participant through the full multi-step registration flow up to
 * the Payment step. Stops at "Complete Registration" — the caller is responsible
 * for clicking that button (or calling `completeRegistrationViaStripe` from
 * stripe.ts) so different specs can compose payment vs. deferred vs. failure paths.
 *
 * Assumes the seed.ts fixture (Skydiving camping option, 4 work-shift categories,
 * and Teardown as the always-required category). If the seed changes shape, this
 * helper will need to adapt.
 */
export interface FillRegistrationOpts {
  /** Phone for the profile step; defaults to a generic test number. */
  phone?: string;
  /** Emergency contact for the profile step. */
  emergencyContact?: string;
  /** Total skydives (required custom field on the Skydiving camping option). */
  totalSkydives?: number;
  /** Skydives in last 6 months (required). */
  recentSkydives?: number;
  /** Years jumping with Burning Sky (required). */
  yearsJumping?: number;
}

/**
 * Walk through Profile → Options → Details → Shifts → Review steps.
 * Leaves the page on the Payment step with "Complete Registration - $XXX" visible.
 */
export async function walkRegistrationToPayment(
  page: Page,
  opts: FillRegistrationOpts = {},
): Promise<void> {
  await page.goto(webUrl('/registration'));
  await expect(page.getByRole('heading', { name: 'Camp Registration' })).toBeVisible({
    timeout: 10_000,
  });

  // Step 1 — Profile. Wait for the form to hydrate from the API before filling,
  // otherwise our writes will be overwritten when the profile arrives and the
  // resulting empty firstName/lastName will silently block the Continue.
  const firstName = page.getByRole('textbox', { name: 'First Name*' });
  await expect(firstName).not.toHaveValue('', { timeout: 10_000 });

  await page.getByRole('textbox', { name: 'Phone Number*' }).fill(opts.phone ?? '555-0100');
  await page
    .getByRole('textbox', { name: 'Emergency Contact(s)*' })
    .fill(opts.emergencyContact ?? 'E2E Contact, 555-0199, friend');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2 — Options. Single seeded camping option ("Skydiving").
  await expect(page.getByRole('heading', { name: 'Select Camping Options' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Skydiving/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3 — Details (custom fields for the chosen camping option).
  // The custom-field labels aren't associated to inputs via for/id, so getByLabel
  // doesn't work. Locate each input by climbing from the label text to its parent
  // wrapper and then descending to the spinbutton.
  await expect(page.getByRole('heading', { name: 'Additional Information' })).toBeVisible();

  const spinbuttonByLabel = (label: string | RegExp) =>
    page
      .getByText(label, { exact: false })
      .locator('xpath=ancestor::div[1]')
      .getByRole('spinbutton');

  await spinbuttonByLabel(/how many skydives have you done in total/i).fill(
    String(opts.totalSkydives ?? 200),
  );
  await spinbuttonByLabel(/how many skydives have you done in the last 6 months/i).fill(
    String(opts.recentSkydives ?? 20),
  );
  await spinbuttonByLabel(/total years jumping with burning sky/i).fill(
    String(opts.yearsJumping ?? 3),
  );
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4 — Shifts. Need at least one camp shift and at least one Teardown shift.
  await expect(page.getByRole('heading', { name: 'Select Work Shifts' })).toBeVisible();

  // Expand the first camp shift category and pick its first checkbox.
  const firstCampCategory = page.getByRole('button', { name: /\(\d+ shifts?\)/ }).first();
  await firstCampCategory.click();
  await page.getByRole('checkbox').nth(0).check();

  // Pick the first Teardown shift (the Additional Shifts section auto-expands its
  // contents next to the always-required Teardown* category).
  const teardownCategory = page.getByRole('button', { name: /Teardown\*/ });
  if (await teardownCategory.isVisible().catch(() => false)) {
    // Already expanded if the heading shows. Click only if collapsed (img toggles).
    const teardownCheckboxes = page.getByRole('checkbox', { name: /Teardown/ });
    if ((await teardownCheckboxes.count()) === 0) {
      await teardownCategory.click();
    }
  }
  await page.getByRole('checkbox', { name: /Teardown Morning/ }).check();

  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 5 — Review & Accept Terms.
  await expect(page.getByRole('heading', { name: 'Review & Accept Terms' })).toBeVisible();
  await page.getByRole('checkbox', { name: /i accept the terms/i }).check();
  await page.getByRole('button', { name: /Review & Pay|Submit/ }).click();

  // Step 6 — Payment. Wait for the "Complete Registration" CTA to be visible.
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Complete Registration/ })).toBeVisible();
}
