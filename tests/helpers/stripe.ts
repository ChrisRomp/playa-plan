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

interface CheckoutOpts {
  /** Card key from STRIPE_TEST_CARDS; defaults to 'success'. */
  card?: StripeTestCard;
  /** Email to use for the receipt; defaults to a generic test address. */
  email?: string;
  /** MM / YY (with the spaces); defaults to 12 / 34. */
  exp?: string;
  /** 3-digit CVC; defaults to 123. */
  cvc?: string;
  /** Cardholder name; defaults to 'Test User'. */
  name?: string;
  /** US ZIP; defaults to 94110. The country defaults to US. */
  zip?: string;
  /** Maximum time to wait for the post-payment redirect away from Stripe. */
  redirectTimeoutMs?: number;
}

/**
 * Drive Stripe's hosted Checkout page (NOT embedded Elements). Assumes the user has
 * just been redirected to https://checkout.stripe.com/c/pay/cs_test_... by clicking
 * "Complete Registration" on the Payment step.
 *
 * Returns once the page has been redirected back to the app (e.g. /#/payment/success
 * or /#/payment/cancel). The caller is responsible for asserting on that destination.
 */
export async function payViaStripeCheckout(page: Page, opts: CheckoutOpts = {}): Promise<void> {
  const card = STRIPE_TEST_CARDS[opts.card ?? 'success'];
  const email = opts.email ?? 'stripe-receipt@test.playaplan.local';
  const exp = opts.exp ?? '12 / 34';
  const cvc = opts.cvc ?? '123';
  const name = opts.name ?? 'Test User';
  const zip = opts.zip ?? '94110';
  const timeout = opts.redirectTimeoutMs ?? 30_000;

  // Confirm we landed on Stripe before driving the form.
  await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 15_000 });

  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Card number' }).fill(card);
  await page.getByRole('textbox', { name: 'Expiration' }).fill(exp);
  await page.getByRole('textbox', { name: 'CVC' }).fill(cvc);
  await page.getByRole('textbox', { name: 'Cardholder name' }).fill(name);

  // Country defaults to US in test mode; ZIP appears for US/CA.
  const zipBox = page.getByRole('textbox', { name: 'ZIP' });
  if (await zipBox.isVisible().catch(() => false)) {
    await zipBox.fill(zip);
  }

  await page.getByRole('button', { name: 'Pay' }).click();

  // Stripe will either redirect to /#/payment/success, /#/payment/cancel, or stay
  // on its own page if 3DS / failure. The caller asserts the destination; we just
  // wait for the URL to leave Stripe.
  await page.waitForURL((url) => !url.toString().includes('checkout.stripe.com'), {
    timeout,
  });
}
