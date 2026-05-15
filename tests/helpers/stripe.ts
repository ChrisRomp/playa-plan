import { Page, FrameLocator } from '@playwright/test';

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

interface FillCardOpts {
  /** Card number; defaults to the success card. */
  card?: StripeTestCard;
  /** MM/YY expiry; defaults to a far-future date. */
  exp?: string;
  /** 3- or 4-digit CVC; defaults to 123. */
  cvc?: string;
  /** ZIP/postal — Stripe Elements requires it for US. */
  zip?: string;
}

/**
 * Locate the Stripe Card Element iframe inside the payment area and fill it.
 * Stripe renders each field in its own iframe; this helper walks them.
 *
 * NOTE: requires `data-testid="payment-iframe-wrapper"` on the wrapper around
 * the Stripe Elements mount node (added in the data-testid pass).
 */
export async function fillStripeCard(page: Page, opts: FillCardOpts = {}): Promise<void> {
  const card = STRIPE_TEST_CARDS[opts.card ?? 'success'];
  const exp = opts.exp ?? '12/34';
  const cvc = opts.cvc ?? '123';
  const zip = opts.zip ?? '94110';

  const wrapper = page.locator('[data-testid="payment-iframe-wrapper"]');
  await wrapper.waitFor({ state: 'visible', timeout: 15_000 });

  // Stripe iframes have name attributes containing the field. Match loosely.
  const numberFrame: FrameLocator = page.frameLocator('iframe[name*="card"][title*="card number" i], iframe[title*="card number" i]').first();
  const expFrame: FrameLocator = page.frameLocator('iframe[title*="expiration" i]').first();
  const cvcFrame: FrameLocator = page.frameLocator('iframe[title*="cvc" i], iframe[title*="security code" i]').first();
  const zipFrame: FrameLocator = page.frameLocator('iframe[title*="zip" i], iframe[title*="postal" i]').first();

  await numberFrame.locator('input[name="cardnumber"], input[autocomplete="cc-number"]').fill(card);
  await expFrame.locator('input[name="exp-date"], input[autocomplete="cc-exp"]').fill(exp);
  await cvcFrame.locator('input[name="cvc"], input[autocomplete="cc-csc"]').fill(cvc);

  // ZIP iframe is optional depending on Stripe Elements config.
  if (await zipFrame.locator('input').count().catch(() => 0)) {
    await zipFrame.locator('input').first().fill(zip);
  }
}

/**
 * Handle Stripe's 3DS challenge popup. Calls completeOrFail with 'complete' to
 * authenticate, 'fail' to fail the challenge.
 */
export async function handle3dsChallenge(
  page: Page,
  action: 'complete' | 'fail' = 'complete',
): Promise<void> {
  const challengeFrame = page.frameLocator('iframe[name*="3ds" i], iframe[name*="stripe-challenge" i]').first();
  const inner = challengeFrame.frameLocator('iframe').first();
  const buttonText = action === 'complete' ? /complete authentication/i : /fail authentication/i;
  await inner.getByRole('button', { name: buttonText }).click({ timeout: 20_000 });
}
