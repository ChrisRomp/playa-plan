import { Page, expect } from '@playwright/test';
import { webUrl } from './env';
import { waitForRegistrationProfileHydrated } from './hydration';

/**
 * Walk a logged-in participant through the full multi-step registration flow up to
 * the Payment step. Stops at "Complete Registration" — the caller is responsible
 * for clicking that button (or calling `payViaStripeCheckout` from stripe.ts) so
 * different specs can compose payment vs. deferred vs. failure paths.
 *
 * Assumes the seed.ts fixture (Skydiving camping option, 4 work-shift categories,
 * and Teardown as the always-required category). Picks shifts by capacity rather
 * than by index so parallel tests don't collide on 1-slot jobs.
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

export async function walkRegistrationToPayment(
  page: Page,
  opts: FillRegistrationOpts = {},
): Promise<void> {
  await page.goto(webUrl('/registration'));
  await expect(page.getByRole('heading', { name: 'Camp Registration' })).toBeVisible({
    timeout: 10_000,
  });

  // Step 1 — Profile. Wait for hydration so our fills aren't overwritten.
  await waitForRegistrationProfileHydrated(page);

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
  // Custom-field labels aren't associated to inputs via for/id, so address each
  // input by climbing from the label text to its parent wrapper.
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

  // Step 4 — Shifts. Pick by capacity, not by index, so parallel tests don't
  // collide on 1-slot jobs. Strategy:
  //   - For each Camp Shift category button (Art Car Driver, Firefly Greeter,
  //     Landing Area, Manifest Assistant, Manifest Manager, etc.), expand it and
  //     pick the FIRST checkbox whose accessible name contains "Spots: N of M
  //     available" with N >= 2. Stop after one camp shift.
  //   - Always-required Teardown category exposes 50- and 20-spot shifts; pick
  //     the 50-spot one to avoid contention.
  await expect(page.getByRole('heading', { name: 'Select Work Shifts' })).toBeVisible();
  await selectFirstAvailableCampShift(page);
  await selectTeardownShift(page);

  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 5 — Review & Accept Terms.
  await expect(page.getByRole('heading', { name: 'Review & Accept Terms' })).toBeVisible();
  await page.getByRole('checkbox', { name: /i accept the terms/i }).check();
  await page.getByRole('button', { name: /Review & Pay|Submit/ }).click();

  // Step 6 — Payment.
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Complete Registration/ })).toBeVisible();
}

/**
 * Open each camp-shift category until we find a shift with at least 2 available
 * spots, then check it. Bails after trying every visible category.
 */
async function selectFirstAvailableCampShift(page: Page): Promise<void> {
  const categoryButtons = page.getByRole('button', { name: /\(\d+ shifts?\)/ });
  const count = await categoryButtons.count();

  for (let i = 0; i < count; i++) {
    const category = categoryButtons.nth(i);
    // Expand and look for a non-tight shift.
    await category.click();
    // Spots: N of M available — match N >= 2 to leave room for parallel tests.
    const roomy = page
      .getByRole('checkbox', { name: /Spots: ([2-9]|\d{2,}) of \d+ available/ })
      .first();
    if (await roomy.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await roomy.check();
      return;
    }
    // Not roomy — collapse and try next.
    await category.click();
  }
  throw new Error(
    '[walkRegistrationToPayment] no camp shift with >=2 available spots found; ' +
      'either bump seed capacity or run fewer parallel registration tests',
  );
}

/** Always-required Teardown — pick the 50-spot Morning shift. */
async function selectTeardownShift(page: Page): Promise<void> {
  const teardownCategory = page.getByRole('button', { name: /Teardown\*/ });
  const teardownCheckboxes = page.getByRole('checkbox', { name: /Teardown/ });
  if ((await teardownCheckboxes.count()) === 0) {
    if (await teardownCategory.isVisible().catch(() => false)) {
      await teardownCategory.click();
    }
  }
  await page.getByRole('checkbox', { name: /Teardown Morning/ }).check();
}
