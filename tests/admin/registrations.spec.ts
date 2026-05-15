/**
 * SCAFFOLD — author against a running stack.
 *
 * Replaces the legacy `tests/admin/registrations.spec.ts.legacy` which made
 * unsupported assumptions about navigation ("Admin Panel" expandable) and seed data.
 *
 * Coverage to add:
 *  - In beforeAll, create a participant + completed paid registration via the API
 *    helpers so the spec owns its data.
 *  - Find the registration by email in /admin/manage-registrations.
 *  - Edit status PENDING → CONFIRMED, add internal notes, save → success toast +
 *    audit record visible in audit trail modal.
 *  - Cancel registration with processRefund=true against a Stripe payment →
 *    Payment.status flips to REFUNDED, audit record created.
 *  - Cancel registration with manual payment → "manual refund required" message.
 *  - RBAC: participant + staff cannot reach this route (covered separately in
 *    rbac.spec.ts; keep one targeted test here too for this page's hardening).
 *
 * Tags: @admin, @admin-registrations, @payment (for refund cases).
 */
import { test } from '@playwright/test';

test.describe('Admin: manage registrations', { tag: ['@admin', '@admin-registrations'] }, () => {
  test.skip(true, 'TODO: rewrite of legacy spec — author against running stack');
  test.use({ storageState: 'tests/.auth/admin.json' });

  test('placeholder', () => {
    // intentionally empty
  });
});
