/**
 * SCAFFOLD — author against a running stack.
 *
 * Coverage to add:
 *  - Create a camping option with mixed custom fields (string + boolean).
 *  - Edit fees + maxSignups, disable.
 *  - Field ordering shows correctly on the participant Registration page.
 *  - Linked job categories appear under that camping option on /registration.
 *
 * Tags: @admin, @admin-camping.
 */
import { test } from '@playwright/test';

test.describe('Admin: camping options', { tag: ['@admin', '@admin-camping'] }, () => {
  test.skip(true, 'TODO: author against running stack');
  test.use({ storageState: 'tests/.auth/admin.json' });

  test('placeholder', () => {
    // intentionally empty
  });
});
