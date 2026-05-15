/**
 * SCAFFOLD — author against a running stack.
 *
 * Coverage to add:
 *  - Log in as e2e-participant-deferred (allowDeferredDuesPayment=true).
 *  - Step through registration; assert the payment step is skipped or shows a
 *    "deferred" notice.
 *  - After submit, registration is CONFIRMED with no Payment row (or a PENDING
 *    Payment row — confirm app behavior during authoring).
 *  - If a "pay now later" affordance exists on the dashboard, exercise it with
 *    the Stripe success card.
 *
 * Tags: @registration, @deferred.
 */
import { test } from '@playwright/test';

test.describe('Registration: deferred dues', { tag: ['@registration', '@deferred'] }, () => {
  test.skip(true, 'TODO: author against running stack');
  test.use({ storageState: 'tests/.auth/participantDeferred.json' });

  test('placeholder', () => {
    // intentionally empty
  });
});
