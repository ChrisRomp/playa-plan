import { Page, expect } from '@playwright/test';

/**
 * Stripe test cards (https://docs.stripe.com/testing).
 *
 * We use Stripe's actual test mode here, so the `stripeApiKey` in seed.local.ts
 * must be a valid `sk_test_...` key. No real charges occur in test mode.
 */
export const STRIPE_TEST_CARDS = {
  success: '4242424242424242',
  insufficientFunds: '4000000000009995',
  genericDecline: '4000000000000002',
  threeDsRequiredSuccess: '4000002500003155',
  threeDsRequiredDeclineAfterChallenge: '4000008260003178',
} as const;

export type StripeTestCard = keyof typeof STRIPE_TEST_CARDS;

interface FillOpts {
  card?: StripeTestCard;
  email?: string;
  exp?: string;
  cvc?: string;
  name?: string;
  zip?: string;
}

/**
 * Fill the Stripe Checkout form fields without clicking Pay. Useful for failure
 * specs that want to assert form-level validation, decline messages, etc.
 */
export async function fillStripeCheckoutForm(page: Page, opts: FillOpts = {}): Promise<void> {
  const card = STRIPE_TEST_CARDS[opts.card ?? 'success'];
  await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 15_000 });

  await page.getByRole('textbox', { name: 'Email' }).fill(opts.email ?? 'stripe-receipt@test.playaplan.local');
  await page.getByRole('textbox', { name: 'Card number' }).fill(card);
  await page.getByRole('textbox', { name: 'Expiration' }).fill(opts.exp ?? '12 / 34');
  await page.getByRole('textbox', { name: 'CVC' }).fill(opts.cvc ?? '123');
  await page.getByRole('textbox', { name: 'Cardholder name' }).fill(opts.name ?? 'Test User');

  // Country defaults to US in test mode; ZIP appears for US/CA.
  const zipBox = page.getByRole('textbox', { name: 'ZIP' });
  if (await zipBox.isVisible().catch(() => false)) {
    await zipBox.fill(opts.zip ?? '94110');
  }
}

/** Click the Pay button. Does not wait for the redirect. */
export async function submitStripePayment(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pay' }).click();
}

/**
 * Wait for the page to leave checkout.stripe.com (back to the app at
 * /#/payment/success or /#/payment/cancel).
 */
export async function waitForAppReturn(page: Page, timeoutMs = 30_000): Promise<void> {
  await page.waitForURL((url) => !url.toString().includes('checkout.stripe.com'), {
    timeout: timeoutMs,
  });
}

/**
 * Assert that Stripe Checkout is showing a card decline message in the form.
 * Stripe surfaces the failure inline rather than redirecting on declined cards.
 */
export async function expectStripeDecline(page: Page): Promise<void> {
  // Stripe's inline error region uses role=alert. Common phrasings: "Your card
  // was declined.", "Your card has insufficient funds.", "Your card number is
  // incorrect.". Match loosely.
  const alert = page
    .locator('[role="alert"]')
    .or(page.getByText(/declined|insufficient funds|incorrect|did not go through/i));
  await expect(alert.first()).toBeVisible({ timeout: 15_000 });
  // We should still be on Stripe; the form did not submit successfully.
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
}

interface CheckoutOpts extends FillOpts {
  /** Maximum time to wait for the post-payment redirect away from Stripe. */
  redirectTimeoutMs?: number;
}

/**
 * High-level convenience wrapper for the happy path: fill, submit, wait for the
 * redirect away from Stripe. Failure/3DS specs should compose the granular
 * helpers above instead.
 */
export async function payViaStripeCheckout(page: Page, opts: CheckoutOpts = {}): Promise<void> {
  await fillStripeCheckoutForm(page, opts);
  await submitStripePayment(page);
  await waitForAppReturn(page, opts.redirectTimeoutMs);
}
