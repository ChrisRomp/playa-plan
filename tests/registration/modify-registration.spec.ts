/**
 * SCAFFOLD — author against a running stack.
 *
 * Coverage to add:
 *  - User attempts to re-register the same year → existing registration is
 *    surfaced (edit flow or "already registered" view).
 *  - Add or remove a job within an existing registration if user-side path
 *    exists; otherwise note the gap and cover it under admin/registrations.
 *
 * Tags: @registration.
 */
import { test } from '@playwright/test';

test.describe('Registration: modify existing', { tag: ['@registration'] }, () => {
  test.skip(true, 'TODO: confirm user-facing modify path during authoring');
  test.use({ storageState: { cookies: [], origins: [] } });

  test('placeholder', () => {
    // intentionally empty
  });
});
