/**
 * SCAFFOLD — author this spec interactively against a running stack.
 *
 * Use `playwright-cli open http://localhost:5173` to explore the multi-step
 * registration flow, then use `playwright-cli snapshot` to grab refs and
 * `playwright-cli generate-locator <ref> --raw` to produce robust selectors.
 *
 * Coverage to add:
 *  - As a fresh participant (testEmail('reg-success')): step through profile →
 *    camping option → custom fields → jobs → terms → Stripe success card.
 *  - Use tests/helpers/stripe.ts → fillStripeCard(page, { card: 'success' }).
 *  - After success URL, assert via API helpers that:
 *      Registration.status === 'CONFIRMED'
 *      Payment.status     === 'COMPLETED'
 *  - Confirm /dashboard reflects the registered state.
 *
 * Tags: @registration, @payment.
 */
import { test } from '@playwright/test';

test.describe('Registration: paid success (Stripe)', { tag: ['@registration', '@payment'] }, () => {
  test.skip(true, 'TODO: author against running stack with seed.local.ts Stripe test keys');
  test.use({ storageState: { cookies: [], origins: [] } });

  test('placeholder', () => {
    // intentionally empty
  });
});
