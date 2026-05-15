/**
 * SCAFFOLD — author against a running stack.
 *
 * Coverage to add (each CRUD action uses a uniquely-named entity so parallel
 * runs don't collide; clean up in afterAll if practical, otherwise rely on
 * the per-run cleanup namespace):
 *
 *  - Job categories: create (uniquely named per run), edit description,
 *    toggle staffOnly + alwaysRequired, delete.
 *  - Shifts: create with HH:MM start/end + DayOfWeek, edit, delete (only when
 *    no jobs assigned). Validation: invalid time format.
 *  - Jobs: create tied to category+shift, change maxRegistrations, delete.
 *    Validation: registrations beyond maxRegistrations should be gated.
 *
 * Tags: @admin, @admin-jobs.
 */
import { test } from '@playwright/test';

test.describe('Admin: job categories / shifts / jobs', { tag: ['@admin', '@admin-jobs'] }, () => {
  test.skip(true, 'TODO: author against running stack');
  test.use({ storageState: 'tests/.auth/admin.json' });

  test('placeholder', () => {
    // intentionally empty
  });
});
