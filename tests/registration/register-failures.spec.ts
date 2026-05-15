/**
 * SCAFFOLD — author against a running stack.
 *
 * Coverage to add:
 *  - Stripe genericDecline card → registration stays PENDING/error UI shown,
 *    no double-charge on retry.
 *  - 3DS challenge fail (handle3dsChallenge(page, 'fail')).
 *  - Required custom field missing → step Next is blocked.
 *  - Job-shift fully booked (use API helper to fill a 1-slot job in beforeAll) →
 *    graceful conflict message.
 *  - Terms not accepted → submit button disabled or shows error.
 *
 * Tags: @registration, @payment, @slow (for 3DS variants).
 */
import { test } from '@playwright/test';

test.describe('Registration: failure paths', { tag: ['@registration', '@payment'] }, () => {
  test.skip(true, 'TODO: author against running stack with seed.local.ts Stripe test keys');
  test.use({ storageState: { cookies: [], origins: [] } });

  test('placeholder', () => {
    // intentionally empty
  });
});
