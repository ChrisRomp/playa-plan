/**
 * SCAFFOLD — author against a running stack.
 *
 * Coverage to add:
 *  - Payments report renders with seeded payments.
 *  - Filter by status/provider/date range.
 *  - Manual payment recorded by admin → shows on the user's registration.
 *  - Refund initiated → status flips to REFUNDED, audit record created.
 *
 * Tags: @admin, @admin-payments, @payment.
 */
import { test } from '@playwright/test';

test.describe('Admin: payments', { tag: ['@admin', '@admin-payments'] }, () => {
  test.skip(true, 'TODO: author against running stack');
  test.use({ storageState: 'tests/.auth/admin.json' });

  test('placeholder', () => {
    // intentionally empty
  });
});
